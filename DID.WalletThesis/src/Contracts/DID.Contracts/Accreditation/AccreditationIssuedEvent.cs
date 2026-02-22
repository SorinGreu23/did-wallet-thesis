namespace DID.Contracts.Accreditation;

public record AccreditationIssuedEvent(
    string AccreditationId,
    string IssuerDID,
    string SubjectDID,
    string? ParentAccreditationId,
    string Scope,
    long BlockNumber,
    string TransactionHash,
    DateTime Timestamp
);
