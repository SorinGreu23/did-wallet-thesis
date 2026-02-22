namespace DID.Contracts.Credential;

public record CredentialSuspendedEvent(
    string CredentialId,
    string SuspendedByDID,
    long BlockNumber,
    string TransactionHash,
    DateTime Timestamp
);
