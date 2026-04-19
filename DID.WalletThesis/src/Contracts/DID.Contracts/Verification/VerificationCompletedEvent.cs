namespace DID.Contracts.Verification;

public record VerificationCompletedEvent(
    string SessionId,
    string VerifierDID,
    string HolderDID,
    bool OverallValid,
    bool SignatureValid,
    bool CredentialActive,
    bool TrustChainValid,
    bool? ZkpValid,
    DateTime VerifiedAt
);
