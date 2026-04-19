namespace DID.Accreditation.Application.DTOs;

public record AccreditationDto(
    string AccreditationId,
    string IssuerDID,
    string SubjectDID,
    string? ParentAccreditationId,
    string Scope,
    string? Name,
    string Status,
    long BlockNumber,
    string TransactionHash,
    DateTime IssuedAt,
    DateTime? RevokedAt,
    string? RevokedByDID
);

public record AccreditationVerificationDto(
    string AccreditationId,
    bool IsValid,
    string Status,
    string? Reason
);

public record IssueAccreditationRequest(
    string IssuerDID,
    string SubjectDID,
    string Scope,
    string? Name,
    string? ParentAccreditationId,
    string? PermissionsHash = null,
    DateTime? ExpiresAt = null
);

public record RecordAccreditationRequest(
    string TxHash,
    string IssuerDID,
    string SubjectDID,
    string Scope,
    string? Name,
    string? ParentAccreditationId
);

public record RevokeAccreditationRequest(
    string RevokedByDID
);
