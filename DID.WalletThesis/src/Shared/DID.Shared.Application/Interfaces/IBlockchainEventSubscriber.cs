using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Shared.Application.Interfaces;

/// <summary>
/// Provides event subscription for long-running background workers (e.g. DID.BlockchainSync).
/// Only the worker service depends on this interface; REST microservices depend on IBlockchainRpcClient.
/// </summary>
public interface IBlockchainEventSubscriber
{
    Task SubscribeToEventAsync<TEvent>(string contractName, string eventName, Func<TEvent, Task> handler, CancellationToken ct = default)
        where TEvent : class, IEventDTO, new();
}
