using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Shared.Application.Interfaces;

public interface IBlockchainService
{
  Task<T> CallContractAsync<T>(string contractName, string functionName, params object[] args);
  Task<string> SubmitTransactionAsync<T>(string contractName, string functionName, params object[] args);
  Task<string> WaitForConfirmationAsync(string txHash, CancellationToken ct = default);
  Task SubscribeToEventAsync<TEvent>(string contractName, string eventName, Func<TEvent, Task> handler, CancellationToken ct = default)
    where TEvent : class, IEventDTO, new();
}
