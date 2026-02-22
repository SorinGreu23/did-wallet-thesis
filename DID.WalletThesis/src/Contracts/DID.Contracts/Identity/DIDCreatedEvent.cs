namespace DID.Contracts.Identity;

public record DIDCreatedEvent(
    string DID,
    string ControllerAddress,
    string PublicKey,
    DateTime CreatedAt
);
