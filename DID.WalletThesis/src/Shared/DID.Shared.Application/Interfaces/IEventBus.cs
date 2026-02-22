namespace DID.Shared.Application.Interfaces;

public interface IEventBus
{
    Task PublishAsync<T>(T message, CancellationToken ct = default) where T : class;
}
