namespace DID.Shared.Domain;

public abstract class Entity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    protected void SetUpdatedAt() => UpdatedAt = DateTime.UtcNow;
}
