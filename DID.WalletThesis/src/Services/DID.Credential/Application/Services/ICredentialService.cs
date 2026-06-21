using DID.Credential.Application.DTOs;

namespace DID.Credential.Application.Services;

/// <summary>
/// Abstraction over credential lifecycle operations.
/// Endpoints inject this interface so the concrete service layer can be mocked in tests.
/// </summary>
public interface ICredentialService
{
    Task<CredentialDto> ResolveAsync(string credentialId, CancellationToken ct = default);
    Task<IEnumerable<CredentialDto>> ListAsync(string? issuerDid, string? holderDid, CancellationToken ct = default);
    Task<CredentialVerificationDto> VerifyAsync(string credentialId, CancellationToken ct = default);
    Task<CredentialDto> IssueAsync(
        string issuerDid, string holderDid, string credentialType,
        string credentialHash,
        string? issuerAccreditationId,
        string? issuerName,
        DateTime? expiresAt,
        CancellationToken ct = default);
    Task<CredentialDto> RecordFromClientTxAsync(
        string txHash,
        string issuerDid, string holderDid, string credentialType,
        string credentialHash,
        string? issuerAccreditationId,
        string? issuerName,
        CancellationToken ct = default);
    Task<bool> RevokeAsync(string credentialId, string revokedByDid, string reason, CancellationToken ct = default);
    Task<bool> RecordRevokedFromClientTxAsync(string txHash, string credentialId, string revokedByDid, string reason, CancellationToken ct = default);
    Task<bool> SuspendAsync(string credentialId, string suspendedByDid, string reason, CancellationToken ct = default);
    Task RecordIssuedAsync(
        string credentialId, string issuerDid, string holderDid,
        string credentialType, string? issuerAccreditationId,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default);
    Task RecordRevokedAsync(
        string credentialId, string revokedByDid, string reason,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default);
    Task RecordSuspendedAsync(
        string credentialId, string suspendedByDid,
        long blockNumber, string transactionHash, DateTime timestamp,
        CancellationToken ct = default);
}
