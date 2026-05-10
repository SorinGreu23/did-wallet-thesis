namespace DID.Accreditation.Application.DTOs;

public record SubmitEnterpriseRegistrationRequest(
    string WalletAddress,
    string LegalName,
    string FiscalCode,
    string? CountryCode,
    string? Country,
    string? City,
    string? Address,
    string? Email,
    string? SignedPayload);

public record EnterpriseRegistrationDto(
    string RequestId,
    string WalletAddress,
    string LegalName,
    string FiscalCode,
    string CountryCode,
    string? City,
    string? Address,
    string? Email,
    string Status,
    string? AccreditationId,
    string? RejectionReason,
    DateTime SubmittedAt,
    DateTime? ReviewedAt);

public record ApproveEnterpriseRegistrationRequest(
    string AccreditationId);

public record RejectEnterpriseRegistrationRequest(
    string Reason);
