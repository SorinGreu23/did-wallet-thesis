using DID.Accreditation.Application.DTOs;

namespace DID.Accreditation.Application.Services;

/// <summary>
/// Abstraction over accreditation lifecycle operations.
/// Endpoints inject this interface so the concrete service layer can be mocked in tests.
/// </summary>
public interface IAccreditationService
{
    Task<AccreditationDto> ResolveAsync(string accreditationId, CancellationToken ct = default);
    Task<IEnumerable<AccreditationDto>> ListAsync(string? issuerDid, string? subjectDid, string? scope = null, CancellationToken ct = default);
    Task<AccreditationVerificationDto> VerifyAsync(string accreditationId, CancellationToken ct = default);
    Task<AccreditationDto> IssueAsync(
        string issuerDid, string subjectDid, string scope,
        string? name,
        string? parentAccreditationId,
        string? permissionsHash,
        DateTime? expiresAt,
        CancellationToken ct = default);
    Task<AccreditationDto> RecordFromClientTxAsync(
        string txHash,
        string issuerDid, string subjectDid, string scope,
        string? name, string? parentAccreditationId,
        CancellationToken ct = default);
    Task<bool> RevokeAsync(string accreditationId, string revokedByDid, CancellationToken ct = default);
    Task<bool> RevokeFromClientTxAsync(string txHash, string accreditationId, string revokedByDid, CancellationToken ct = default);
    Task RecordIssuedAsync(
        string accreditationId, string issuerDid, string subjectDid,
        string? parentAccreditationId, string scope, string? name,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default);
    Task RecordRevokedAsync(
        string accreditationId, string revokedByDid,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default);
}
