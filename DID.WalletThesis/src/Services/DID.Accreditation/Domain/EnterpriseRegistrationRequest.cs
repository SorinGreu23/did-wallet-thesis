using DID.Shared.Domain;

namespace DID.Accreditation.Domain;

public enum RegistrationRequestStatus { Pending, Approved, Rejected }

public class EnterpriseRegistrationRequest : Entity
{
    public string RequestId { get; set; } = Guid.NewGuid().ToString();
    public string WalletAddress { get; set; } = string.Empty;
    public string LegalName { get; set; } = string.Empty;
    public string FiscalCode { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Address { get; set; }
    public string? Email { get; set; }
    public string? SignedPayload { get; set; }
    public RegistrationRequestStatus Status { get; set; } = RegistrationRequestStatus.Pending;
    public string? AccreditationId { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedByDid { get; set; }
}
