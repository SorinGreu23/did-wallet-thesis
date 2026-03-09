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
            entities = await repository.GetByIssuerDIDAsync(issuerDid, ct);
        else if (holderDid is not null)
            entities = await repository.GetByHolderDIDAsync(holderDid, ct);
        else
            entities = await repository.GetAllAsync(ct);

        return entities.Select(ToDto);
    }

    public async Task<CredentialVerificationDto> VerifyAsync(string credentialId, CancellationToken ct = default)
    {
        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null)
            return new CredentialVerificationDto(credentialId, false, "NotFound", "Credential does not exist");

        if (onChain.Revoked)
            return new CredentialVerificationDto(credentialId, false, "Revoked",
                "Credential has been revoked on-chain");

        if (onChain.Suspended)
            return new CredentialVerificationDto(credentialId, false, "Suspended",
                "Credential has been suspended on-chain");

        if (onChain.ExpiresAtUnix > 0 && DateTimeOffset.UtcNow.ToUnixTimeSeconds() > (long)onChain.ExpiresAtUnix)
            return new CredentialVerificationDto(credentialId, false, "Expired",
                $"Expired at {DateTimeOffset.FromUnixTimeSeconds((long)onChain.ExpiresAtUnix):O}");

        var isValid = await blockchain.CallContractAsync<bool>(
            "CredentialRegistry",
            "verifyCredential",
            HexToBytes32(credentialId));

        return isValid
            ? new CredentialVerificationDto(credentialId, true, "Active", null)
            : new CredentialVerificationDto(credentialId, false, "Invalid",
                "Credential validation failed on-chain");
    }

    public async Task<CredentialDto> IssueAsync(
        string issuerDid, string holderDid, string credentialType,
        string? issuerAccreditationId,
        DateTime? expiresAt,
        CancellationToken ct = default)
    {
        EnsureSignerMatchesIssuer(issuerDid);

        var holderAddress = ExtractAddress(holderDid);
        var accreditationBytes = HexToBytes32(issuerAccreditationId);
        var expiresAtUnix = expiresAt is null
            ? BigInteger.Zero
            : new BigInteger(new DateTimeOffset(DateTime.SpecifyKind(expiresAt.Value, DateTimeKind.Utc)).ToUnixTimeSeconds());

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            "CredentialRegistry",
            "issueCredential",
            holderAddress,
            credentialType,
            accreditationBytes,
            expiresAtUnix);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        var credentialId = await FindIssuedCredentialIdAsync(
            signerAddress,
            holderAddress,
            credentialType,
            accreditationBytes);

        var onChain = await GetRequiredOnChainCredentialAsync(credentialId);

        logger.LogInformation(
            "Issued credential {Id} on-chain from {Issuer} to {Holder} in tx {TxHash}",
            credentialId,
            signerAddress,
            holderAddress,
            txHash);

        return ToDto(onChain, txHash, 0);
    }

    public async Task<bool> RevokeAsync(
        string credentialId, string revokedByDid, string reason, CancellationToken ct = default)
    {
        EnsureSignerMatchesIssuer(revokedByDid);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            "CredentialRegistry",
            "revokeCredential",
            HexToBytes32(credentialId),
            reason);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        logger.LogInformation("Revoked credential {Id} on-chain in tx {TxHash}", credentialId, txHash);
        return true;
    }

    public async Task<bool> SuspendAsync(
        string credentialId, string suspendedByDid, CancellationToken ct = default)
    {
        EnsureSignerMatchesIssuer(suspendedByDid);

        var onChain = await GetOnChainCredentialAsync(credentialId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            "CredentialRegistry",
            "suspendCredential",
            HexToBytes32(credentialId));

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

            if (!string.Equals(candidate.CredentialType, credentialType, StringComparison.Ordinal))
                continue;

            if (!candidate.IssuerAccreditationId.SequenceEqual(accreditationBytes))
                continue;

            return Bytes32ToHex(credentialId);
        }

        throw new InvalidOperationException("Unable to locate the newly issued credential on-chain");
    }

    private void EnsureSignerMatchesIssuer(string issuerDid)
    {
        var issuerAddress = ExtractAddress(issuerDid);
        if (!string.Equals(issuerAddress, signerAddress, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Issuer {issuerDid} does not match configured blockchain signer {ToDid(signerAddress)}");
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

        var status = credential.Revoked
            ? CredentialStatus.Revoked.ToString()
            : credential.Suspended
                ? CredentialStatus.Suspended.ToString()
                : CredentialStatus.Active.ToString();

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
}
