namespace DID.Shared.Application.Interfaces;

/// <summary>
/// Combined interface that joins <see cref="IBlockchainRpcClient"/> and <see cref="IBlockchainEventSubscriber"/>.
/// <para>
/// REST microservices should inject <see cref="IBlockchainRpcClient"/> — they never need event subscriptions.
/// The DID.BlockchainSync worker injects <see cref="IBlockchainEventSubscriber"/> (or this full interface).
/// </para>
/// <para>
/// <see cref="BlockchainService"/> implements this combined interface, so the single DI registration
/// satisfies all three interface types automatically.
/// </para>
/// </summary>
public interface IBlockchainService : IBlockchainRpcClient, IBlockchainEventSubscriber
{
}
