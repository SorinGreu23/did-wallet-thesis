using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Shared.Application.Interfaces;

public interface IBlockchainService
{
  Task<T> CallContractAsync<T>(string contractName, string functionName, params object[] args);
  Task<string> SubmitTransactionAsync<T>(string contractName, string functionName, params object[] args);
  Task<string> SubmitTransactionAsync<T>(string signerPrivateKey, string contractName, string functionName, params object[] args);
  Task<string> WaitForConfirmationAsync(string txHash, CancellationToken ct = default);
  /// <summary>
  /// Decodes all occurrences of <typeparamref name="TEvent"/> from the logs of
  /// a confirmed transaction receipt. Returns an empty list when none are found.
  /// </summary>
  Task<IReadOnlyList<TEvent>> FindEventsInReceiptAsync<TEvent>(string contractName, string txHash)
    where TEvent : class, IEventDTO, new();
  Task SubscribeToEventAsync<TEvent>(string contractName, string eventName, Func<TEvent, Task> handler, CancellationToken ct = default)
    where TEvent : class, IEventDTO, new();
}
