using DID.Shared.Domain;

namespace DID.Credential.Domain;

public enum CredentialStatus { Active, Revoked, Suspended, Expired }

public class Credential : Entity
{
    public string CredentialId { get; set; } = string.Empty;
    public string IssuerDID { get; set; } = string.Empty;
    public string HolderDID { get; set; } = string.Empty;
    public string CredentialType { get; set; } = string.Empty;
    public string? IssuerAccreditationId { get; set; }
    public string? IssuerName { get; set; }
    public CredentialStatus Status { get; set; } = CredentialStatus.Active;
    public long BlockNumber { get; set; }
    public string TransactionHash { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevokedByDID { get; set; }
    public string? RevocationReason { get; set; }
    public DateTime? SuspendedAt { get; set; }
    public string? SuspendedByDID { get; set; }
}
