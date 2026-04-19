namespace DID.Credential.Application.DTOs;

public record CredentialDto(
    string CredentialId,
    string IssuerDID,
    string HolderDID,
    string CredentialType,
    string? IssuerAccreditationId,
    string? IssuerName,
    string Status,
    long BlockNumber,
    string TransactionHash,
    DateTime IssuedAt,
    DateTime? RevokedAt,
    string? RevokedByDID,
    string? RevocationReason,
    DateTime? SuspendedAt,
    string? SuspendedByDID
);

public record CredentialVerificationDto(
    string CredentialId,
    bool IsValid,
    string Status,
    string? Reason
);

public record IssueCredentialRequest(
    string IssuerDID,
    string HolderDID,
    string CredentialType,
    string CredentialHash,
    string? IssuerAccreditationId,
    string? IssuerName,
    DateTime? ExpiresAt
);

public record RevokeCredentialRequest(
    string RevokedByDID,
    string Reason,
    string? RevokedByPrivateKey = null
);

public record SuspendCredentialRequest(
    string SuspendedByDID,
    string Reason,
    string? SuspendedByPrivateKey = null
);

public record RecordCredentialRequest(
    string TxHash,
    string IssuerDID,
    string HolderDID,
    string CredentialType,
    string CredentialHash,
    string? IssuerAccreditationId,
    string? IssuerName
);
