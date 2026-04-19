namespace DID.Contracts.Accreditation;

public record AccreditationRevokedEvent(
    string AccreditationId,
    string RevokedByDID,
    long BlockNumber,
    string TransactionHash,
    DateTime Timestamp
);
