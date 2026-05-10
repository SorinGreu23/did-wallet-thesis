namespace DID.Contracts.Accreditation;

public record EnterpriseRegistrationApprovedEvent(
    string RequestId,
    string WalletAddress,
    string LegalName,
    string CountryCode,
    string AccreditationId,
    string ReviewedByDid,
    DateTime ReviewedAt
);
