using DID.Credential.Application.DTOs;
using DID.Credential.Domain;
using DID.Credential.Domain.Interfaces;
using DID.Shared.Application.Constants;
using DID.Shared.Application.Interfaces;
using DID.Shared.Application.Utils;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Nethereum.Web3.Accounts;
using System.Numerics;

namespace DID.Credential.Application.Services;

public class CredentialService(
    ICredentialRepository repository,
    IBlockchainRpcClient blockchain,
    IOptions<BlockchainOptions> blockchainOptions,
    ILogger<CredentialService> logger) : ICredentialService
{
    private readonly string signerAddress = BlockchainAddressUtils.NormalizeAddress(new Account(blockchainOptions.Value.PrivateKey).Address);

    private enum OnChainCredentialStatus
    {
        Active = 0,
        Revoked = 1,
        Suspended = 2,
        Expired = 3
    }

    public async Task<CredentialDto> ResolveAsync(string credentialId, CancellationToken ct = default)
    {
        var entity = await repository.GetByCredentialIdAsync(credentialId, ct);
        if (entity is not null)
            return ToDto(entity);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null)
            throw new KeyNotFoundException($"Credential {credentialId} not found");

        return ToDto(onChain, transactionHash: string.Empty, blockNumber: 0);
    }

    public async Task<IEnumerable<CredentialDto>> ListAsync(
        string? issuerDid, string? holderDid, CancellationToken ct = default)
    {
        IEnumerable<Domain.Credential> entities;

        if (issuerDid is not null)
            entities = await repository.GetByIssuerDIDAsync(BlockchainAddressUtils.ToDid(issuerDid), ct);
        else if (holderDid is not null)
            entities = await repository.GetByHolderDIDAsync(BlockchainAddressUtils.ToDid(holderDid), ct);
        else
            entities = await repository.GetAllAsync(ct);

        return entities.Select(ToDto);
    }

    public async Task<CredentialVerificationDto> VerifyAsync(string credentialId, CancellationToken ct = default)
    {
        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null)
            return new CredentialVerificationDto(credentialId, false, "NotFound", "Credential does not exist");

        var verification = await blockchain.CallContractAsync<VerifyCredentialResultDto>(
            SmartContractConstants.Contracts.CredentialRegistry,
            SmartContractConstants.CredentialFunctions.VerifyCredential,
            BlockchainAddressUtils.HexToBytes32(credentialId));

        var status = MapStatus(verification.Status);
        var reason = verification.IsValid
            ? null
            : status switch
            {
                CredentialStatus.Revoked => "Credential has been revoked on-chain",
                CredentialStatus.Suspended => "Credential has been suspended on-chain",
                CredentialStatus.Expired => $"Expired at {DateTimeOffset.FromUnixTimeSeconds(SafeToLong(onChain.ExpiresAtUnix)):O}",
                _ when !verification.TrustChainValid => "Issuer trust chain validation failed on-chain",
                _ => "Credential validation failed on-chain"
            };

        return new CredentialVerificationDto(
            credentialId,
            verification.IsValid,
            status.ToString(),
            reason);
    }

    public async Task<CredentialDto> IssueAsync(
        string issuerDid, string holderDid, string credentialType,
        string credentialHash,
        string? issuerAccreditationId,
        string? issuerName,
        DateTime? expiresAt,
        CancellationToken ct = default)
    {
        var effectivePrivateKey = blockchainOptions.Value.PrivateKey;
        var effectiveAccount = new Account(effectivePrivateKey);
        var effectiveSignerAddress = BlockchainAddressUtils.NormalizeAddress(effectiveAccount.Address);

        EnsureSignerMatchesIssuer(issuerDid, effectiveSignerAddress);

        var holderAddress = BlockchainAddressUtils.ExtractAddress(holderDid);
        var credentialHashBytes = BlockchainAddressUtils.HexToBytes32(credentialHash);
        var accreditationBytes = BlockchainAddressUtils.HexToBytes32(issuerAccreditationId);
        var expiresAtUnix = expiresAt is null
            ? BigInteger.Zero
            : new BigInteger(new DateTimeOffset(DateTime.SpecifyKind(expiresAt.Value, DateTimeKind.Utc)).ToUnixTimeSeconds());

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            SmartContractConstants.Contracts.CredentialRegistry,
            SmartContractConstants.CredentialFunctions.RecordCredential,
            holderAddress,
            credentialHashBytes,
            credentialType,
            accreditationBytes,
            expiresAtUnix);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        var credentialId = await FindIssuedCredentialIdAsync(
            effectiveSignerAddress,
            holderAddress,
            credentialHashBytes,
            credentialType,
            accreditationBytes);

        var onChain = await GetRequiredOnChainCredentialAsync(credentialId);

        // Persist immediately so BlockchainSync's RecordIssuedAsync finds it and skips
        if (await repository.GetByCredentialIdAsync(credentialId, ct) is null)
        {
            var entity = new Domain.Credential
            {
                CredentialId = credentialId,
                IssuerDID = BlockchainAddressUtils.ToDid(effectiveSignerAddress),
                HolderDID = BlockchainAddressUtils.ToDid(holderAddress),
                CredentialType = credentialType,
                IssuerAccreditationId = issuerAccreditationId,
                IssuerName = issuerName,
                Status = CredentialStatus.Active,
                BlockNumber = 0,
                TransactionHash = txHash,
                IssuedAt = DateTimeOffset.FromUnixTimeSeconds(SafeToLong(onChain.IssuedAtUnix)).UtcDateTime,
            };
            await repository.AddAsync(entity, ct);
            await repository.SaveChangesAsync(ct);
        }

        logger.LogInformation(
            "Issued credential {Id} on-chain from {Issuer} to {Holder} in tx {TxHash}",
            credentialId,
            effectiveSignerAddress,
            holderAddress,
            txHash);

        return ToDto(onChain, txHash, 0, issuerName);
    }

    /// <summary>
    /// Records a credential that was issued on-chain by the caller's own wallet
    /// (e.g. a university issuing a diploma). The private key never reaches the server.
    /// </summary>
    public async Task<CredentialDto> RecordFromClientTxAsync(
        string txHash,
        string issuerDid, string holderDid, string credentialType,
        string credentialHash,
        string? issuerAccreditationId,
        string? issuerName,
        CancellationToken ct = default)
    {
        await blockchain.WaitForConfirmationAsync(txHash, ct);

        var issuerAddress = BlockchainAddressUtils.ExtractAddress(issuerDid);
        var holderAddress = BlockchainAddressUtils.ExtractAddress(holderDid);
        var credentialHashBytes = BlockchainAddressUtils.HexToBytes32(credentialHash);
        var accreditationBytes = BlockchainAddressUtils.HexToBytes32(issuerAccreditationId);

        var credentialId = await FindIssuedCredentialIdAsync(
            issuerAddress, holderAddress, credentialHashBytes, credentialType, accreditationBytes);

        var onChain = await GetRequiredOnChainCredentialAsync(credentialId);

        if (!string.Equals(BlockchainAddressUtils.NormalizeAddress(onChain.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"On-chain issuer {onChain.Issuer} does not match claimed issuer {issuerDid}");

        logger.LogInformation(
            "Recording client-submitted credential {Id} from {Issuer} to {Holder} in tx {TxHash}",
            credentialId, issuerAddress, holderAddress, txHash);

        if (await repository.GetByCredentialIdAsync(credentialId, ct) is null)
        {
            var entity = new Domain.Credential
            {
                CredentialId = credentialId,
                IssuerDID = BlockchainAddressUtils.ToDid(issuerAddress),
                HolderDID = BlockchainAddressUtils.ToDid(holderAddress),
                CredentialType = credentialType,
                IssuerAccreditationId = issuerAccreditationId,
                IssuerName = issuerName,
                Status = CredentialStatus.Active,
                BlockNumber = 0,
                TransactionHash = txHash,
                IssuedAt = DateTimeOffset.FromUnixTimeSeconds(SafeToLong(onChain.IssuedAtUnix)).UtcDateTime,
            };
            await repository.AddAsync(entity, ct);
            await repository.SaveChangesAsync(ct);
        }

        return ToDto(onChain, txHash, 0, issuerName);
    }

    public async Task<bool> RevokeAsync(
        string credentialId, string revokedByDid, string reason, CancellationToken ct = default)
    {
        var effectivePrivateKey = blockchainOptions.Value.PrivateKey;
        var effectiveSignerAddress = signerAddress;

        EnsureSignerMatchesIssuer(revokedByDid, effectiveSignerAddress);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            SmartContractConstants.Contracts.CredentialRegistry,
            SmartContractConstants.CredentialFunctions.RevokeCredential,
            BlockchainAddressUtils.HexToBytes32(credentialId),
            reason);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        logger.LogInformation("Revoked credential {Id} on-chain in tx {TxHash}", credentialId, txHash);
        return true;
    }

    public async Task<bool> SuspendAsync(
        string credentialId, string suspendedByDid, string reason, CancellationToken ct = default)
    {
        var effectivePrivateKey = blockchainOptions.Value.PrivateKey;
        var effectiveSignerAddress = signerAddress;

        EnsureSignerMatchesIssuer(suspendedByDid, effectiveSignerAddress);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            SmartContractConstants.Contracts.CredentialRegistry,
            SmartContractConstants.CredentialFunctions.SuspendCredential,
            BlockchainAddressUtils.HexToBytes32(credentialId),
            reason);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        logger.LogInformation("Suspended credential {Id} on-chain in tx {TxHash}", credentialId, txHash);
        return true;
    }

    public async Task RecordIssuedAsync(
        string credentialId, string issuerDid, string holderDid,
        string credentialType, string? issuerAccreditationId,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default)
    {
        var existing = await repository.GetByCredentialIdAsync(credentialId, ct);
        if (existing is not null)
        {
            if (existing.BlockNumber == 0 && blockNumber != 0)
            {
                existing.BlockNumber = blockNumber;
                existing.TransactionHash = transactionHash;
                await repository.UpdateAsync(existing, ct);
                await repository.SaveChangesAsync(ct);
            }
            logger.LogWarning("Credential {Id} already recorded, skipping", credentialId);
            return;
        }

        var entity = new Domain.Credential
        {
            CredentialId = credentialId,
            IssuerDID = BlockchainAddressUtils.ToDid(issuerDid),
            HolderDID = BlockchainAddressUtils.ToDid(holderDid),
            CredentialType = credentialType,
            IssuerAccreditationId = issuerAccreditationId,
            Status = CredentialStatus.Active,
            BlockNumber = blockNumber,
            TransactionHash = transactionHash,
            IssuedAt = timestamp
        };

        await repository.AddAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Recorded credential {Id} issued by {Issuer} for {Holder}",
            credentialId, issuerDid, holderDid);
    }

    public async Task RecordRevokedAsync(
        string credentialId, string revokedByDid, string reason,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default)
    {
        var entity = await repository.GetByCredentialIdAsync(credentialId, ct);

        if (entity is null)
        {
            logger.LogWarning("Credential {Id} not found for revocation", credentialId);
            return;
        }

        entity.Status = CredentialStatus.Revoked;
        entity.RevokedByDID = BlockchainAddressUtils.ToDid(revokedByDid);
        entity.RevocationReason = reason;
        entity.RevokedAt = timestamp;
        entity.UpdatedAt = DateTime.UtcNow;

        await repository.UpdateAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Recorded revocation of credential {Id} by {RevokedBy}",
            credentialId, revokedByDid);
    }

    public async Task RecordSuspendedAsync(
        string credentialId, string suspendedByDid,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default)
    {
        var entity = await repository.GetByCredentialIdAsync(credentialId, ct);

        if (entity is null)
        {
            logger.LogWarning("Credential {Id} not found for suspension", credentialId);
            return;
        }

        entity.Status = CredentialStatus.Suspended;
        entity.SuspendedByDID = BlockchainAddressUtils.ToDid(suspendedByDid);
        entity.SuspendedAt = timestamp;
        entity.UpdatedAt = DateTime.UtcNow;

        await repository.UpdateAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Recorded suspension of credential {Id} by {SuspendedBy}",
            credentialId, suspendedByDid);
    }

    private static CredentialDto ToDto(Domain.Credential e) => new(
        CredentialId: e.CredentialId,
        IssuerDID: e.IssuerDID,
        HolderDID: e.HolderDID,
        CredentialType: e.CredentialType,
        IssuerAccreditationId: e.IssuerAccreditationId,
        IssuerName: e.IssuerName,
        Status: e.Status.ToString(),
        BlockNumber: e.BlockNumber,
        TransactionHash: e.TransactionHash,
        IssuedAt: e.IssuedAt,
        RevokedAt: e.RevokedAt,
        RevokedByDID: e.RevokedByDID,
        RevocationReason: e.RevocationReason,
        SuspendedAt: e.SuspendedAt,
        SuspendedByDID: e.SuspendedByDID
    );

    private async Task<OnChainCredentialDto?> GetOnChainCredentialAsync(string credentialId)
    {
        var credential = await blockchain.CallContractAsync<OnChainCredentialDto>(
            SmartContractConstants.Contracts.CredentialRegistry,
            SmartContractConstants.CredentialFunctions.Credentials,
            BlockchainAddressUtils.HexToBytes32(credentialId));

        return credential.Exists ? credential : null;
    }

    private async Task<OnChainCredentialDto> GetRequiredOnChainCredentialAsync(string credentialId)
        => await GetOnChainCredentialAsync(credentialId)
            ?? throw new KeyNotFoundException($"Credential {credentialId} not found on-chain");

    private async Task<string> FindIssuedCredentialIdAsync(
        string issuerAddress,
        string holderAddress,
        byte[] credentialHashBytes,
        string credentialType,
        byte[] accreditationBytes)
    {
        var credentialIds = await blockchain.CallContractAsync<List<byte[]>>(
            SmartContractConstants.Contracts.CredentialRegistry,
            SmartContractConstants.CredentialFunctions.GetCredentialsByHolder,
            holderAddress);

        foreach (var credentialId in credentialIds.AsEnumerable().Reverse())
        {
            var candidate = await blockchain.CallContractAsync<OnChainCredentialDto>(
                SmartContractConstants.Contracts.CredentialRegistry,
                SmartContractConstants.CredentialFunctions.Credentials,
                credentialId);

            if (!candidate.Exists)
                continue;

            if (!string.Equals(BlockchainAddressUtils.NormalizeAddress(candidate.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!string.Equals(BlockchainAddressUtils.NormalizeAddress(candidate.Holder), holderAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!candidate.CredentialHash.SequenceEqual(credentialHashBytes))
                continue;

            if (!string.Equals(candidate.CredentialType, credentialType, StringComparison.Ordinal))
                continue;

            if (!candidate.IssuerAccreditationId.SequenceEqual(accreditationBytes))
                continue;

            return BlockchainAddressUtils.Bytes32ToHex(credentialId);
        }

        throw new InvalidOperationException("Unable to locate the newly issued credential on-chain");
    }

    private static void EnsureSignerMatchesIssuer(string issuerDid, string effectiveSignerAddress)
    {
        var issuerAddress = BlockchainAddressUtils.ExtractAddress(issuerDid);
        if (!string.Equals(issuerAddress, effectiveSignerAddress, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Issuer {issuerDid} does not match configured blockchain signer {BlockchainAddressUtils.ToDid(effectiveSignerAddress)}");
        }
    }


    private static CredentialDto ToDto(OnChainCredentialDto credential, string transactionHash, long blockNumber, string? issuerName = null)
    {
        var issuerAccreditationId = credential.IssuerAccreditationId.Any(b => b != 0)
            ? BlockchainAddressUtils.Bytes32ToHex(credential.IssuerAccreditationId)
            : null;

        var status = MapStatus(credential.Status).ToString();

        return new CredentialDto(
            CredentialId: BlockchainAddressUtils.Bytes32ToHex(credential.Id),
            IssuerDID: BlockchainAddressUtils.ToDid(credential.Issuer),
            HolderDID: BlockchainAddressUtils.ToDid(credential.Holder),
            CredentialType: credential.CredentialType,
            IssuerAccreditationId: issuerAccreditationId,
            IssuerName: issuerName,
            Status: status,
            BlockNumber: blockNumber,
            TransactionHash: transactionHash,
            IssuedAt: DateTimeOffset.FromUnixTimeSeconds(SafeToLong(credential.IssuedAtUnix)).UtcDateTime,
            RevokedAt: null,
            RevokedByDID: null,
            RevocationReason: null,
            SuspendedAt: null,
            SuspendedByDID: null);
    }

    private static CredentialStatus MapStatus(int status) => status switch
    {
        (int)OnChainCredentialStatus.Active => CredentialStatus.Active,
        (int)OnChainCredentialStatus.Revoked => CredentialStatus.Revoked,
        (int)OnChainCredentialStatus.Suspended => CredentialStatus.Suspended,
        (int)OnChainCredentialStatus.Expired => CredentialStatus.Expired,
        _ => throw new InvalidOperationException($"Unsupported on-chain credential status: {status}")
    };

    private static long SafeToLong(BigInteger value) =>
        value > long.MaxValue ? long.MaxValue : (long)value;
}
