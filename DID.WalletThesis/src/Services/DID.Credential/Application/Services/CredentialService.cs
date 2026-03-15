using DID.Credential.Application.DTOs;
using DID.Credential.Domain;
using DID.Credential.Domain.Interfaces;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Nethereum.Web3.Accounts;
using System.Numerics;

namespace DID.Credential.Application.Services;

public class CredentialService(
    ICredentialRepository repository,
    IBlockchainService blockchain,
    IOptions<BlockchainOptions> blockchainOptions,
    ILogger<CredentialService> logger)
{
    private const string DidPrefix = "did:ethr:sepolia:";
    private readonly string signerAddress = NormalizeAddress(new Account(blockchainOptions.Value.PrivateKey).Address);

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
            entities = await repository.GetByIssuerDIDAsync(ToDid(issuerDid), ct);
        else if (holderDid is not null)
            entities = await repository.GetByHolderDIDAsync(ToDid(holderDid), ct);
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
            "CredentialRegistry",
            "verifyCredential",
            HexToBytes32(credentialId));

        var status = MapStatus(verification.Status);
        var reason = verification.IsValid
            ? null
            : status switch
            {
                CredentialStatus.Revoked => "Credential has been revoked on-chain",
                CredentialStatus.Suspended => "Credential has been suspended on-chain",
                CredentialStatus.Expired => $"Expired at {DateTimeOffset.FromUnixTimeSeconds((long)onChain.ExpiresAtUnix):O}",
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
        DateTime? expiresAt,
        string? issuerPrivateKey = null,
        CancellationToken ct = default)
    {
        var effectivePrivateKey = issuerPrivateKey ?? blockchainOptions.Value.PrivateKey;
        var effectiveAccount = new Account(effectivePrivateKey);
        var effectiveSignerAddress = NormalizeAddress(effectiveAccount.Address);
        var effectiveIssuerDid = issuerPrivateKey is not null
            ? ToDid(effectiveSignerAddress)
            : issuerDid;

        EnsureSignerMatchesIssuer(effectiveIssuerDid, effectiveSignerAddress);

        var holderAddress = ExtractAddress(holderDid);
        var credentialHashBytes = HexToBytes32(credentialHash);
        var accreditationBytes = HexToBytes32(issuerAccreditationId);
        var expiresAtUnix = expiresAt is null
            ? BigInteger.Zero
            : new BigInteger(new DateTimeOffset(DateTime.SpecifyKind(expiresAt.Value, DateTimeKind.Utc)).ToUnixTimeSeconds());

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            "CredentialRegistry",
            "recordCredential",
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

        logger.LogInformation(
            "Issued credential {Id} on-chain from {Issuer} to {Holder} in tx {TxHash}",
            credentialId,
            effectiveSignerAddress,
            holderAddress,
            txHash);

        return ToDto(onChain, txHash, 0);
    }

    public async Task<bool> RevokeAsync(
        string credentialId, string revokedByDid, string reason, string? revokedByPrivateKey = null, CancellationToken ct = default)
    {
        var effectivePrivateKey = revokedByPrivateKey ?? blockchainOptions.Value.PrivateKey;
        var effectiveSignerAddress = NormalizeAddress(new Account(effectivePrivateKey).Address);
        var effectiveRevokerDid = revokedByPrivateKey is not null
            ? ToDid(effectiveSignerAddress)
            : revokedByDid;

        EnsureSignerMatchesIssuer(effectiveRevokerDid, effectiveSignerAddress);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            "CredentialRegistry",
            "revokeCredential",
            HexToBytes32(credentialId),
            reason);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        logger.LogInformation("Revoked credential {Id} on-chain in tx {TxHash}", credentialId, txHash);
        return true;
    }

    public async Task<bool> SuspendAsync(
        string credentialId, string suspendedByDid, string reason, string? suspendedByPrivateKey = null, CancellationToken ct = default)
    {
        var effectivePrivateKey = suspendedByPrivateKey ?? blockchainOptions.Value.PrivateKey;
        var effectiveSignerAddress = NormalizeAddress(new Account(effectivePrivateKey).Address);
        var effectiveSuspenderDid = suspendedByPrivateKey is not null
            ? ToDid(effectiveSignerAddress)
            : suspendedByDid;

        EnsureSignerMatchesIssuer(effectiveSuspenderDid, effectiveSignerAddress);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            "CredentialRegistry",
            "suspendCredential",
            HexToBytes32(credentialId),
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
        if (await repository.GetByCredentialIdAsync(credentialId, ct) is not null)
        {
            logger.LogWarning("Credential {Id} already recorded, skipping", credentialId);
            return;
        }

        var entity = new Domain.Credential
        {
            CredentialId = credentialId,
            IssuerDID = ToDid(issuerDid),
            HolderDID = ToDid(holderDid),
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
        entity.RevokedByDID = ToDid(revokedByDid);
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
        entity.SuspendedByDID = ToDid(suspendedByDid);
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
            "CredentialRegistry",
            "credentials",
            HexToBytes32(credentialId));

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
            "CredentialRegistry",
            "getCredentialsByHolder",
            holderAddress);

        foreach (var credentialId in credentialIds.AsEnumerable().Reverse())
        {
            var candidate = await blockchain.CallContractAsync<OnChainCredentialDto>(
                "CredentialRegistry",
                "credentials",
                credentialId);

            if (!candidate.Exists)
                continue;

            if (!string.Equals(NormalizeAddress(candidate.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!string.Equals(NormalizeAddress(candidate.Holder), holderAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!candidate.CredentialHash.SequenceEqual(credentialHashBytes))
                continue;

            if (!string.Equals(candidate.CredentialType, credentialType, StringComparison.Ordinal))
                continue;

            if (!candidate.IssuerAccreditationId.SequenceEqual(accreditationBytes))
                continue;

            return Bytes32ToHex(credentialId);
        }

        throw new InvalidOperationException("Unable to locate the newly issued credential on-chain");
    }

    private static void EnsureSignerMatchesIssuer(string issuerDid, string effectiveSignerAddress)
    {
        var issuerAddress = ExtractAddress(issuerDid);
        if (!string.Equals(issuerAddress, effectiveSignerAddress, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Issuer {issuerDid} does not match configured blockchain signer {ToDid(effectiveSignerAddress)}");
        }
    }

    private static byte[] HexToBytes32(string? hex)
    {
        if (string.IsNullOrWhiteSpace(hex))
            return new byte[32];

        var normalized = hex.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? hex[2..] : hex;
        if (normalized.Length != 64)
            throw new ArgumentException("Expected 32-byte hex value", nameof(hex));

        return Convert.FromHexString(normalized);
    }

    private static string Bytes32ToHex(byte[] bytes) => "0x" + Convert.ToHexString(bytes).ToLowerInvariant();

    private static string ExtractAddress(string didOrAddress)
    {
        if (string.IsNullOrWhiteSpace(didOrAddress))
            throw new ArgumentException("Value is required", nameof(didOrAddress));

        var candidate = didOrAddress.Trim();
        if (candidate.StartsWith(DidPrefix, StringComparison.OrdinalIgnoreCase))
            candidate = candidate[DidPrefix.Length..];

        return NormalizeAddress(candidate);
    }

    private static string NormalizeAddress(string address)
    {
        if (!address.StartsWith("0x", StringComparison.OrdinalIgnoreCase) || address.Length != 42)
            throw new ArgumentException($"Invalid Ethereum address: {address}", nameof(address));

        return address.ToLowerInvariant();
    }

    private static string ToDid(string didOrAddress)
    {
        var address = ExtractAddress(didOrAddress);
        return $"{DidPrefix}{address}";
    }

    private static CredentialDto ToDto(OnChainCredentialDto credential, string transactionHash, long blockNumber)
    {
        var issuerAccreditationId = credential.IssuerAccreditationId.Any(b => b != 0)
            ? Bytes32ToHex(credential.IssuerAccreditationId)
            : null;

        var status = MapStatus(credential.Status).ToString();

        return new CredentialDto(
            CredentialId: Bytes32ToHex(credential.Id),
            IssuerDID: ToDid(credential.Issuer),
            HolderDID: ToDid(credential.Holder),
            CredentialType: credential.CredentialType,
            IssuerAccreditationId: issuerAccreditationId,
            Status: status,
            BlockNumber: blockNumber,
            TransactionHash: transactionHash,
            IssuedAt: DateTimeOffset.FromUnixTimeSeconds((long)credential.IssuedAtUnix).UtcDateTime,
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
}
