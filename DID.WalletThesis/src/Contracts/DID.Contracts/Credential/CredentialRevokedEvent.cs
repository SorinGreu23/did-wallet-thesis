namespace DID.Contracts.Credential;

public record CredentialRevokedEvent(
    string CredentialId,
    string RevokedByDID,
    string Reason,
    long BlockNumber,
    string TransactionHash,
    DateTime Timestamp
);
