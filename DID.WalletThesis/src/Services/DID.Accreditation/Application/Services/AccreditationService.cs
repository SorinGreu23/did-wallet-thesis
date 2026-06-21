using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Domain;
using DID.Accreditation.Domain.Interfaces;
using DID.Shared.Application.Constants;
using DID.Shared.Application.Enums;
using DID.Shared.Application.Interfaces;
using DID.Shared.Application.Utils;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Web3.Accounts;
using System.Numerics;

namespace DID.Accreditation.Application.Services;

/// <summary>Nethereum typed DTO for the AccreditationIssued on-chain event.</summary>
[Event("AccreditationIssued")]
file sealed class AccreditationIssuedEvent : IEventDTO
{
    [Parameter("bytes32", "id", 1, true)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "issuer", 2, true)]
    public string Issuer { get; set; } = string.Empty;

    [Parameter("address", "subject", 3, true)]
    public string Subject { get; set; } = string.Empty;

    [Parameter("uint8", "scope", 4, false)]
    public byte Scope { get; set; }

    [Parameter("bytes32", "parentAccreditationId", 5, false)]
    public byte[] ParentAccreditationId { get; set; } = [];
}

public class AccreditationService(
    IAccreditationRepository repository,
    IBlockchainRpcClient blockchain,
    IOptions<BlockchainOptions> blockchainOptions,
    ILogger<AccreditationService> logger) : IAccreditationService
{
    private readonly string signerAddress = BlockchainAddressUtils.NormalizeAddress(new Account(blockchainOptions.Value.PrivateKey).Address);

    public async Task<AccreditationDto> ResolveAsync(string accreditationId, CancellationToken ct = default)
    {
        var entity = await repository.GetByAccreditationIdAsync(accreditationId, ct);
        if (entity is not null)
            return ToDto(entity);

        var onChain = await GetOnChainAccreditationAsync(accreditationId);
        if (onChain is null)
            throw new KeyNotFoundException($"Accreditation {accreditationId} not found");

        return ToDto(onChain, transactionHash: string.Empty, blockNumber: 0);
    }

    public async Task<IEnumerable<AccreditationDto>> ListAsync(
        string? issuerDid, string? subjectDid, string? scope = null, CancellationToken ct = default)
    {
        IEnumerable<Domain.Accreditation> entities;

        if (issuerDid is not null && scope is not null)
            entities = await repository.GetByIssuerDIDAndScopeAsync(issuerDid, scope, ct);
        else if (issuerDid is not null)
            entities = await repository.GetByIssuerDIDAsync(issuerDid, ct);
        else if (subjectDid is not null)
            entities = await repository.GetBySubjectDIDAsync(subjectDid, ct);
        else
            entities = await repository.GetAllAsync(ct);

        return entities.Select(ToDto);
    }

    public async Task<AccreditationVerificationDto> VerifyAsync(string accreditationId, CancellationToken ct = default)
    {
        var onChain = await GetOnChainAccreditationAsync(accreditationId);
        if (onChain is null)
            return new AccreditationVerificationDto(accreditationId, false, "NotFound", "Accreditation does not exist");

        if (onChain.Revoked)
            return new AccreditationVerificationDto(accreditationId, false, "Revoked",
                "Accreditation has been revoked on-chain");

        if (IsExpired(onChain.ExpiresAtUnix))
            return new AccreditationVerificationDto(accreditationId, false, "Expired",
                $"Expired at {DateTimeOffset.FromUnixTimeSeconds(SafeToLong(onChain.ExpiresAtUnix)):O}");

        var isValid = await blockchain.CallContractAsync<bool>(
            SmartContractConstants.Contracts.AccreditationRegistry,
            SmartContractConstants.AccreditationFunctions.ValidateTrustChain,
            BlockchainAddressUtils.HexToBytes32(accreditationId));

        return isValid
            ? new AccreditationVerificationDto(accreditationId, true, "Active", null)
            : new AccreditationVerificationDto(accreditationId, false, "InvalidTrustChain",
                "Trust chain validation failed on-chain");
    }

    public async Task<AccreditationDto> IssueAsync(
        string issuerDid, string subjectDid, string scope,
        string? name,
        string? parentAccreditationId,
        string? permissionsHash,
        DateTime? expiresAt,
        CancellationToken ct = default)
    {
        // EU Root signs with the backend-configured key — private key never leaves the server
        var effectivePrivateKey = blockchainOptions.Value.PrivateKey;
        var effectiveAccount = new Account(effectivePrivateKey);
        var effectiveSignerAddress = BlockchainAddressUtils.NormalizeAddress(effectiveAccount.Address);

        EnsureSignerMatchesIssuer(issuerDid, effectiveSignerAddress);

        var subjectAddress = BlockchainAddressUtils.ExtractAddress(subjectDid);
        var scopeValue = (byte)AccreditationScopeExtensions.ParseScope(scope);
        var parentBytes = BlockchainAddressUtils.HexToBytes32(parentAccreditationId);
        var permissionsBytes = BlockchainAddressUtils.HexToBytes32(permissionsHash);
        var expiresAtUnix = expiresAt is null
            ? BigInteger.Zero
            : new BigInteger(new DateTimeOffset(DateTime.SpecifyKind(expiresAt.Value, DateTimeKind.Utc)).ToUnixTimeSeconds());

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            SmartContractConstants.Contracts.AccreditationRegistry,
            SmartContractConstants.AccreditationFunctions.IssueAccreditation,
            subjectAddress,
            scopeValue,
            parentBytes,
            permissionsBytes,
            expiresAtUnix);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        // Prefer reading the accreditation ID directly from the emitted event log
        // to avoid relying on Nethereum's bytes32[] array decoding (which can return null).
        var issuedEvents = await blockchain.FindEventsInReceiptAsync<AccreditationIssuedEvent>(
            SmartContractConstants.Contracts.AccreditationRegistry, txHash);
        var accreditationId = issuedEvents.Count > 0
            ? BlockchainAddressUtils.Bytes32ToHex(issuedEvents[0].Id)
            : await FindIssuedAccreditationIdAsync(
                effectiveSignerAddress,
                subjectAddress,
                scopeValue,
                parentBytes,
                permissionsBytes);

        var onChain = await GetRequiredOnChainAccreditationAsync(accreditationId);

        logger.LogInformation(
            "Issued accreditation {Id} on-chain from {Issuer} to {Subject} in tx {TxHash}",
            accreditationId,
            effectiveSignerAddress,
            subjectAddress,
            txHash);

        // Persist immediately so the record is available without waiting for the blockchain sync consumer
        if (await repository.GetByAccreditationIdAsync(accreditationId, ct) is null)
        {
            var entity = new Domain.Accreditation
            {
                AccreditationId = accreditationId,
                IssuerDID = issuerDid,
                SubjectDID = BlockchainAddressUtils.ToDid(subjectAddress),
                ParentAccreditationId = parentAccreditationId,
                Scope = AccreditationScopeExtensions.ToScopeStringOrNull(scopeValue) ?? scopeValue.ToString(),
                Name = name,
                Status = AccreditationStatus.Active,
                BlockNumber = 0,
                TransactionHash = txHash,
                IssuedAt = DateTime.UtcNow
            };
            await repository.AddAsync(entity, ct);
            await repository.SaveChangesAsync(ct);
        }

        return ToDto(onChain, txHash, 0, name);
    }

    /// <summary>
    /// Records an accreditation that was issued on-chain by the caller's own wallet
    /// (e.g. a member state issuing to a ministry). The private key never reaches the server.
    /// </summary>
    public async Task<AccreditationDto> RecordFromClientTxAsync(
        string txHash,
        string issuerDid, string subjectDid, string scope,
        string? name, string? parentAccreditationId,
        CancellationToken ct = default)
    {
        // 1. Wait for the tx the client already submitted
        await blockchain.WaitForConfirmationAsync(txHash, ct);

        var issuerAddress = BlockchainAddressUtils.ExtractAddress(issuerDid);
        var subjectAddress = BlockchainAddressUtils.ExtractAddress(subjectDid);
        var scopeValue = (byte)AccreditationScopeExtensions.ParseScope(scope);
        var parentBytes = BlockchainAddressUtils.HexToBytes32(parentAccreditationId);
        var permissionsBytes = BlockchainAddressUtils.HexToBytes32(null); // clients don't set permissions

        // 2. Locate the resulting accreditation on-chain — prefer the event log
        var issuedEvents = await blockchain.FindEventsInReceiptAsync<AccreditationIssuedEvent>(
            SmartContractConstants.Contracts.AccreditationRegistry, txHash);
        var accreditationId = issuedEvents.Count > 0
            ? BlockchainAddressUtils.Bytes32ToHex(issuedEvents[0].Id)
            : await FindIssuedAccreditationIdAsync(
                issuerAddress, subjectAddress, scopeValue, parentBytes, permissionsBytes);

        // 3. Read and verify the on-chain record
        var onChain = await GetRequiredOnChainAccreditationAsync(accreditationId);

        if (!string.Equals(BlockchainAddressUtils.NormalizeAddress(onChain.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"On-chain issuer {onChain.Issuer} does not match claimed issuer {issuerDid}");

        logger.LogInformation(
            "Recording client-submitted accreditation {Id} from {Issuer} to {Subject} in tx {TxHash}",
            accreditationId, issuerAddress, subjectAddress, txHash);

        // 4. Persist
        await RecordIssuedAsync(
            accreditationId, issuerAddress, subjectAddress,
            parentAccreditationId, AccreditationScopeExtensions.ToScopeStringOrNull(scopeValue) ?? scopeValue.ToString(), name,
            0, txHash, DateTime.UtcNow, ct);

        return ToDto(onChain, txHash, 0, name);
    }

    public async Task<bool> RevokeAsync(
        string accreditationId, string revokedByDid, CancellationToken ct = default)
    {
        var onChain = await GetOnChainAccreditationAsync(accreditationId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            SmartContractConstants.Contracts.AccreditationRegistry,
            SmartContractConstants.AccreditationFunctions.RevokeAccreditation,
            BlockchainAddressUtils.HexToBytes32(accreditationId));

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        logger.LogInformation("Revoked accreditation {Id} on-chain in tx {TxHash}", accreditationId, txHash);
        return true;
    }

    /// <summary>
    /// Records a revocation whose on-chain transaction was signed and submitted
    /// entirely by the caller's browser wallet. The private key never reaches the server.
    /// </summary>
    public async Task<bool> RevokeFromClientTxAsync(
        string txHash, string accreditationId, string revokedByDid, CancellationToken ct = default)
    {
        var onChain = await GetOnChainAccreditationAsync(accreditationId);
        if (onChain is null || !onChain.Exists)
            return false;

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        // Confirm the chain reflects the revocation
        var updated = await GetOnChainAccreditationAsync(accreditationId);
        if (updated is null || !updated.Revoked)
            throw new InvalidOperationException(
                $"Accreditation {accreditationId} is not revoked on-chain after tx {txHash}");

        logger.LogInformation(
            "Client-revoked accreditation {Id} on-chain in tx {TxHash}", accreditationId, txHash);

        await RecordRevokedAsync(accreditationId, revokedByDid, 0, txHash, DateTime.UtcNow, ct);
        return true;
    }

    public async Task RecordIssuedAsync(
        string accreditationId, string issuerDid, string subjectDid,
        string? parentAccreditationId, string scope, string? name,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default)
    {
        if (await repository.GetByAccreditationIdAsync(accreditationId, ct) is not null)
        {
            logger.LogWarning("Accreditation {Id} already recorded, skipping", accreditationId);
            return;
        }

        var entity = new Domain.Accreditation
        {
            AccreditationId = accreditationId,
            IssuerDID = BlockchainAddressUtils.ToDid(issuerDid),
            SubjectDID = BlockchainAddressUtils.ToDid(subjectDid),
            ParentAccreditationId = parentAccreditationId,
            Scope = scope,
            Name = name,
            Status = AccreditationStatus.Active,
            BlockNumber = blockNumber,
            TransactionHash = transactionHash,
            IssuedAt = timestamp
        };

        await repository.AddAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Recorded accreditation {Id} issued by {Issuer} for {Subject}",
            accreditationId, issuerDid, subjectDid);
    }

    public async Task RecordRevokedAsync(
        string accreditationId, string revokedByDid,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default)
    {
        var entity = await repository.GetByAccreditationIdAsync(accreditationId, ct);

        if (entity is null)
        {
            logger.LogWarning("Accreditation {Id} not found for revocation", accreditationId);
            return;
        }

        entity.Status = AccreditationStatus.Revoked;
        entity.RevokedByDID = BlockchainAddressUtils.ToDid(revokedByDid);
        entity.RevokedAt = timestamp;
        entity.UpdatedAt = DateTime.UtcNow;

        await repository.UpdateAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Recorded revocation of accreditation {Id} by {RevokedBy}",
            accreditationId, revokedByDid);
    }

    private static AccreditationDto ToDto(Domain.Accreditation e) => new(
        AccreditationId: e.AccreditationId,
        IssuerDID: e.IssuerDID,
        SubjectDID: e.SubjectDID,
        ParentAccreditationId: e.ParentAccreditationId,
        Scope: e.Scope,
        Name: e.Name,
        Status: e.Status.ToString(),
        BlockNumber: e.BlockNumber,
        TransactionHash: e.TransactionHash,
        IssuedAt: e.IssuedAt,
        RevokedAt: e.RevokedAt,
        RevokedByDID: e.RevokedByDID
    );

    private async Task<OnChainAccreditationDto?> GetOnChainAccreditationAsync(string accreditationId)
    {
        var accreditation = await blockchain.CallContractAsync<OnChainAccreditationDto>(
            SmartContractConstants.Contracts.AccreditationRegistry,
            SmartContractConstants.AccreditationFunctions.Accreditations,
            BlockchainAddressUtils.HexToBytes32(accreditationId));

        return accreditation.Exists ? accreditation : null;
    }

    private async Task<OnChainAccreditationDto> GetRequiredOnChainAccreditationAsync(string accreditationId)
        => await GetOnChainAccreditationAsync(accreditationId)
            ?? throw new KeyNotFoundException($"Accreditation {accreditationId} not found on-chain");

    private async Task<string> FindIssuedAccreditationIdAsync(
        string issuerAddress,
        string subjectAddress,
        byte scopeValue,
        byte[] parentBytes,
        byte[] permissionsBytes)
    {
        var accreditationIds = await blockchain.CallContractAsync<List<byte[]>>(
            SmartContractConstants.Contracts.AccreditationRegistry,
            SmartContractConstants.AccreditationFunctions.GetAccreditationsBySubject,
            subjectAddress);

        foreach (var accreditationId in ((IEnumerable<byte[]>?)accreditationIds ?? []).Reverse())
        {
            var candidate = await blockchain.CallContractAsync<OnChainAccreditationDto>(
                SmartContractConstants.Contracts.AccreditationRegistry,
                SmartContractConstants.AccreditationFunctions.Accreditations,
                accreditationId);

            if (!candidate.Exists)
                continue;

            if (!string.Equals(BlockchainAddressUtils.NormalizeAddress(candidate.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!string.Equals(BlockchainAddressUtils.NormalizeAddress(candidate.Subject), subjectAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (candidate.Scope != scopeValue)
                continue;

            if (!candidate.ParentAccreditationId.SequenceEqual(parentBytes))
                continue;

            if (!candidate.PermissionsHash.SequenceEqual(permissionsBytes))
                continue;

            return BlockchainAddressUtils.Bytes32ToHex(accreditationId);
        }

        throw new InvalidOperationException("Unable to locate the newly issued accreditation on-chain");
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




    private static AccreditationDto ToDto(OnChainAccreditationDto accreditation, string transactionHash, long blockNumber, string? name = null)
    {
        var parentAccreditationId = accreditation.ParentAccreditationId.Any(b => b != 0)
            ? BlockchainAddressUtils.Bytes32ToHex(accreditation.ParentAccreditationId)
            : null;

        return new AccreditationDto(
            AccreditationId: BlockchainAddressUtils.Bytes32ToHex(accreditation.Id),
            IssuerDID: BlockchainAddressUtils.ToDid(accreditation.Issuer),
            SubjectDID: BlockchainAddressUtils.ToDid(accreditation.Subject),
            ParentAccreditationId: parentAccreditationId,
            Scope: AccreditationScopeExtensions.ToScopeStringOrNull(accreditation.Scope) ?? accreditation.Scope.ToString(),
            Name: name,
            Status: accreditation.Revoked ? AccreditationStatus.Revoked.ToString() : AccreditationStatus.Active.ToString(),
            BlockNumber: blockNumber,
            TransactionHash: transactionHash,
            IssuedAt: DateTimeOffset.FromUnixTimeSeconds(SafeToLong(accreditation.IssuedAtUnix)).UtcDateTime,
            RevokedAt: null,
            RevokedByDID: null);
    }

    private static bool IsExpired(BigInteger expiresAtUnix)
    {
        if (expiresAtUnix == 0) return false;
        if (expiresAtUnix > long.MaxValue) return false;
        return DateTimeOffset.UtcNow.ToUnixTimeSeconds() > (long)expiresAtUnix;
    }

    private static long SafeToLong(BigInteger value) =>
        value > long.MaxValue ? long.MaxValue : (long)value;
}
