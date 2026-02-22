namespace DID.Contracts.Credential;

public record CredentialIssuedEvent(
    string CredentialId,
    string IssuerDID,
    string HolderDID,
    string CredentialType,
    string? HolderEmail,
    long BlockNumber,
    string TransactionHash,
    DateTime Timestamp
);
