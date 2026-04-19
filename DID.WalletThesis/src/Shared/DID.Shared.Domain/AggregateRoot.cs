namespace DID.Shared.Domain;
public abstract class AggregateRoot : Entity
{
    private readonly List<object> _domainEvents = [];
    public IReadOnlyList<object> DomainEvents => _domainEvents.AsReadOnly();
    protected void AddDomainEvent(object domainEvent) => _domainEvents.Add(domainEvent);
    public void ClearDomainEvent() => _domainEvents.Clear();
}