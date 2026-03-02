using DID.Shared.Domain;

namespace DID.Accreditation.Domain;

public enum AccreditationStatus { Active, Revoked }

public class Accreditation : Entity
{
    public string AccreditationId { get; set; } = string.Empty;
    public string IssuerDID { get; set; } = string.Empty;
    public string SubjectDID { get; set; } = string.Empty;
    public string? ParentAccreditationId { get; set; }
    public string Scope { get; set; } = string.Empty;
    public AccreditationStatus Status { get; set; } = AccreditationStatus.Active;
    public long BlockNumber { get; set; }
    public string TransactionHash { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevokedByDID { get; set; }
}
