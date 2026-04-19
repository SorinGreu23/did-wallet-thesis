using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Domain;
using DID.Accreditation.Domain.Interfaces;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Nethereum.Web3.Accounts;
using System.Numerics;

namespace DID.Accreditation.Application.Services;

public class AccreditationService(
    IAccreditationRepository repository,
    IBlockchainService blockchain,
    IOptions<BlockchainOptions> blockchainOptions,
    ILogger<AccreditationService> logger)
{
    private const string DidPrefix = "did:ethr:sepolia:";
    private readonly string signerAddress = NormalizeAddress(new Account(blockchainOptions.Value.PrivateKey).Address);

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

        if (onChain.ExpiresAtUnix > 0 && DateTimeOffset.UtcNow.ToUnixTimeSeconds() > (long)onChain.ExpiresAtUnix)
            return new AccreditationVerificationDto(accreditationId, false, "Expired",
                $"Expired at {DateTimeOffset.FromUnixTimeSeconds((long)onChain.ExpiresAtUnix):O}");

        var isValid = await blockchain.CallContractAsync<bool>(
            "AccreditationRegistry",
            "validateTrustChain",
            HexToBytes32(accreditationId));

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
        var effectiveSignerAddress = NormalizeAddress(effectiveAccount.Address);

        EnsureSignerMatchesIssuer(issuerDid, effectiveSignerAddress);

        var subjectAddress = ExtractAddress(subjectDid);
        var scopeValue = ParseScope(scope);
        var parentBytes = HexToBytes32(parentAccreditationId);
        var permissionsBytes = HexToBytes32(permissionsHash);
        var expiresAtUnix = expiresAt is null
            ? BigInteger.Zero
            : new BigInteger(new DateTimeOffset(DateTime.SpecifyKind(expiresAt.Value, DateTimeKind.Utc)).ToUnixTimeSeconds());

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            effectivePrivateKey,
            "AccreditationRegistry",
            "issueAccreditation",
            subjectAddress,
            scopeValue,
            parentBytes,
            permissionsBytes,
            expiresAtUnix);

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        var accreditationId = await FindIssuedAccreditationIdAsync(
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
                SubjectDID = ToDid(subjectAddress),
                ParentAccreditationId = parentAccreditationId,
                Scope = ScopeToString(scopeValue),
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

        var issuerAddress = ExtractAddress(issuerDid);
        var subjectAddress = ExtractAddress(subjectDid);
        var scopeValue = ParseScope(scope);
        var parentBytes = HexToBytes32(parentAccreditationId);
        var permissionsBytes = HexToBytes32(null); // clients don't set permissions

        // 2. Locate the resulting accreditation on-chain
        var accreditationId = await FindIssuedAccreditationIdAsync(
            issuerAddress, subjectAddress, scopeValue, parentBytes, permissionsBytes);

        // 3. Read and verify the on-chain record
        var onChain = await GetRequiredOnChainAccreditationAsync(accreditationId);

        if (!string.Equals(NormalizeAddress(onChain.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"On-chain issuer {onChain.Issuer} does not match claimed issuer {issuerDid}");

        logger.LogInformation(
            "Recording client-submitted accreditation {Id} from {Issuer} to {Subject} in tx {TxHash}",
            accreditationId, issuerAddress, subjectAddress, txHash);

        // 4. Persist
        await RecordIssuedAsync(
            accreditationId, issuerAddress, subjectAddress,
            parentAccreditationId, ScopeToString(scopeValue), name,
            0, txHash, DateTime.UtcNow, ct);

        return ToDto(onChain, txHash, 0, name);
    }

    public async Task<bool> RevokeAsync(
        string accreditationId, string revokedByDid, CancellationToken ct = default)
    {
        EnsureSignerMatchesIssuer(revokedByDid, signerAddress);

        var onChain = await GetOnChainAccreditationAsync(accreditationId);
        if (onChain is null || !onChain.Exists)
            return false;

        var txHash = await blockchain.SubmitTransactionAsync<object>(
            "AccreditationRegistry",
            "revokeAccreditation",
            HexToBytes32(accreditationId));

        await blockchain.WaitForConfirmationAsync(txHash, ct);

        logger.LogInformation("Revoked accreditation {Id} on-chain in tx {TxHash}", accreditationId, txHash);
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
            IssuerDID = ToDid(issuerDid),
            SubjectDID = ToDid(subjectDid),
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
        entity.RevokedByDID = ToDid(revokedByDid);
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
            "AccreditationRegistry",
            "accreditations",
            HexToBytes32(accreditationId));

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
            "AccreditationRegistry",
            "getAccreditationsBySubject",
            subjectAddress);

        foreach (var accreditationId in accreditationIds.AsEnumerable().Reverse())
        {
            var candidate = await blockchain.CallContractAsync<OnChainAccreditationDto>(
                "AccreditationRegistry",
                "accreditations",
                accreditationId);

            if (!candidate.Exists)
                continue;

            if (!string.Equals(NormalizeAddress(candidate.Issuer), issuerAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!string.Equals(NormalizeAddress(candidate.Subject), subjectAddress, StringComparison.OrdinalIgnoreCase))
                continue;

            if (candidate.Scope != scopeValue)
                continue;

            if (!candidate.ParentAccreditationId.SequenceEqual(parentBytes))
                continue;

            if (!candidate.PermissionsHash.SequenceEqual(permissionsBytes))
                continue;

            return Bytes32ToHex(accreditationId);
        }

        throw new InvalidOperationException("Unable to locate the newly issued accreditation on-chain");
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

    private static byte ParseScope(string scope) => scope.Trim().ToLowerInvariant() switch
    {
        "memberstate" => 1,
        "ministry" => 2,
        "institution" => 3,
        "department" => 4,
        _ => throw new ArgumentOutOfRangeException(nameof(scope), scope,
            "Unsupported accreditation scope. Valid values are: MemberState, Ministry, Institution, Department")
    };

    private static string ScopeToString(byte scope) => scope switch
    {
        1 => "MemberState",
        2 => "Ministry",
        3 => "Institution",
        4 => "Department",
        _ => "None"
    };

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

    private static AccreditationDto ToDto(OnChainAccreditationDto accreditation, string transactionHash, long blockNumber, string? name = null)
    {
        var parentAccreditationId = accreditation.ParentAccreditationId.Any(b => b != 0)
            ? Bytes32ToHex(accreditation.ParentAccreditationId)
            : null;

        return new AccreditationDto(
            AccreditationId: Bytes32ToHex(accreditation.Id),
            IssuerDID: ToDid(accreditation.Issuer),
            SubjectDID: ToDid(accreditation.Subject),
            ParentAccreditationId: parentAccreditationId,
            Scope: ScopeToString(accreditation.Scope),
            Name: name,
            Status: accreditation.Revoked ? AccreditationStatus.Revoked.ToString() : AccreditationStatus.Active.ToString(),
            BlockNumber: blockNumber,
            TransactionHash: transactionHash,
            IssuedAt: DateTimeOffset.FromUnixTimeSeconds((long)accreditation.IssuedAtUnix).UtcDateTime,
            RevokedAt: null,
            RevokedByDID: null);
    }
}
