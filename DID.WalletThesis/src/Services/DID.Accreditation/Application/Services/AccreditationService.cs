using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Domain;
using DID.Accreditation.Domain.Interfaces;

namespace DID.Accreditation.Application.Services;

public class AccreditationService(
    IAccreditationRepository repository,
    ILogger<AccreditationService> logger)
{
    public async Task<AccreditationDto> ResolveAsync(string accreditationId, CancellationToken ct = default)
    {
        var entity = await repository.GetByAccreditationIdAsync(accreditationId, ct)
            ?? throw new KeyNotFoundException($"Accreditation {accreditationId} not found");

        return ToDto(entity);
    }

    public async Task<IEnumerable<AccreditationDto>> ListAsync(
        string? issuerDid, string? subjectDid, CancellationToken ct = default)
    {
        IEnumerable<Domain.Accreditation> entities;

        if (issuerDid is not null)
            entities = await repository.GetByIssuerDIDAsync(issuerDid, ct);
        else if (subjectDid is not null)
            entities = await repository.GetBySubjectDIDAsync(subjectDid, ct);
        else
            entities = await repository.GetAllAsync(ct);

        return entities.Select(ToDto);
    }

    public async Task<AccreditationVerificationDto> VerifyAsync(string accreditationId, CancellationToken ct = default)
    {
        var entity = await repository.GetByAccreditationIdAsync(accreditationId, ct);

        if (entity is null)
            return new AccreditationVerificationDto(accreditationId, false, "NotFound", "Accreditation does not exist");

        if (entity.Status == AccreditationStatus.Revoked)
            return new AccreditationVerificationDto(accreditationId, false, "Revoked",
                $"Revoked at {entity.RevokedAt:O} by {entity.RevokedByDID}");

        return new AccreditationVerificationDto(accreditationId, true, "Active", null);
    }

    public async Task<AccreditationDto> IssueAsync(
        string issuerDid, string subjectDid, string scope,
        string? parentAccreditationId, CancellationToken ct = default)
    {
        var accreditationId = "0x" + Guid.NewGuid().ToString("N");

        var entity = new Domain.Accreditation
        {
            AccreditationId = accreditationId,
            IssuerDID = issuerDid,
            SubjectDID = subjectDid,
            ParentAccreditationId = parentAccreditationId,
            Scope = scope,
            Status = AccreditationStatus.Active,
            BlockNumber = 0,
            TransactionHash = string.Empty,
            IssuedAt = DateTime.UtcNow
        };

        await repository.AddAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Issued accreditation {Id} from {Issuer} to {Subject}", accreditationId, issuerDid, subjectDid);

        return ToDto(entity);
    }

    public async Task<bool> RevokeAsync(
        string accreditationId, string revokedByDid, CancellationToken ct = default)
    {
        var entity = await repository.GetByAccreditationIdAsync(accreditationId, ct);

        if (entity is null) return false;

        entity.Status = AccreditationStatus.Revoked;
        entity.RevokedByDID = revokedByDid;
        entity.RevokedAt = DateTime.UtcNow;
        entity.UpdatedAt = DateTime.UtcNow;

        await repository.UpdateAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Revoked accreditation {Id} by {RevokedBy}", accreditationId, revokedByDid);

        return true;
    }

    public async Task RecordIssuedAsync(
        string accreditationId, string issuerDid, string subjectDid,
        string? parentAccreditationId, string scope,
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
            IssuerDID = issuerDid,
            SubjectDID = subjectDid,
            ParentAccreditationId = parentAccreditationId,
            Scope = scope,
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
        entity.RevokedByDID = revokedByDid;
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
        Status: e.Status.ToString(),
        BlockNumber: e.BlockNumber,
        TransactionHash: e.TransactionHash,
        IssuedAt: e.IssuedAt,
        RevokedAt: e.RevokedAt,
        RevokedByDID: e.RevokedByDID
    );
}
