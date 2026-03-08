using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.Hex.HexTypes;
using Nethereum.RPC.Eth.DTOs;
using Nethereum.Web3;
using Nethereum.Web3.Accounts;

namespace DID.Shared.Infrastructure.Blockchain;

public class BlockchainService : IBlockchainService
{
  private readonly Web3 _web3;
  private readonly BlockchainOptions _options;
  private readonly ILogger<BlockchainService> _logger;
  private readonly Dictionary<string, string> _abis = [];

  private const int PollIntervalMs = 2_000;

  public BlockchainService(IOptions<BlockchainOptions> options, ILogger<BlockchainService> logger)
  {
    _options = options.Value;
    _logger = logger;

    var account = new Account(_options.PrivateKey);
    _web3 = new Web3(account, _options.RpcUrl);

    LoadAbis();
  }

  public async Task<T> CallContractAsync<T>(string contractName, string functionName, params object[] args)
  {
    var contract = GetContract(contractName);
    var function = contract.GetFunction(functionName);
    return await function.CallAsync<T>(args);
  }

  public async Task<string> SubmitTransactionAsync<T>(string contractName, string functionName, params object[] args)
  {
    var contract = GetContract(contractName);
    var function = contract.GetFunction(functionName);
    var fromAddress = _web3.TransactionManager.Account.Address;
    var gas = await function.EstimateGasAsync(fromAddress, null, null, args);
    var transactionInput = function.CreateTransactionInput(fromAddress, gas, null, args);
    var txHash = await _web3.TransactionManager.SendTransactionAsync(transactionInput);
    _logger.LogInformation("Transaction submitted: {TxHash} for {Contract}.{Function}",
        txHash, contractName, functionName);
    return txHash;
  }

  public async Task SubscribeToEventAsync<TEvent>(
      string contractName, string eventName,
      Func<TEvent, Task> handler, CancellationToken ct = default)
      where TEvent : class, IEventDTO, new()
  {
    var contractAddress = ResolveContractAddress(contractName);
    var eventHandler = _web3.Eth.GetEvent<TEvent>(contractAddress);

    var lastBlock = await _web3.Eth.Blocks.GetBlockNumber.SendRequestAsync();
    var fromBlock = new BlockParameter(lastBlock);

    _logger.LogInformation(
        "Listening for {Event} on {Contract} ({Address}) from block {Block}",
        eventName, contractName, contractAddress, lastBlock.Value);

    while (!ct.IsCancellationRequested)
    {
      try
      {
        var filter = eventHandler.CreateFilterInput(fromBlock, BlockParameter.CreateLatest());
        var logs = await eventHandler.GetAllChangesAsync(filter);

        foreach (var log in logs)
        {
          _logger.LogDebug("Received {Event} in tx {TxHash} block {Block}",
              eventName, log.Log.TransactionHash, log.Log.BlockNumber.Value);

          await handler(log.Event);

          // Move past this block so we don't re-process
          var next = log.Log.BlockNumber.Value + 1;
          fromBlock = new BlockParameter(new HexBigInteger(next));
        }

        await Task.Delay(PollIntervalMs, ct);
      }
      catch (OperationCanceledException)
      {
        break;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error polling {Event} on {Contract}, retrying…",
            eventName, contractName);
        await Task.Delay(PollIntervalMs * 2, ct);
      }
    }

    _logger.LogInformation("Stopped listening for {Event} on {Contract}", eventName, contractName);
  }

  public async Task<string> WaitForConfirmationAsync(string txHash, CancellationToken ct = default)
  {
    while (!ct.IsCancellationRequested)
    {
      var receipt = await _web3.Eth.Transactions.GetTransactionReceipt
          .SendRequestAsync(txHash);

      if (receipt is not null)
      {
        if (receipt.Status.Value == 1)
        {
          _logger.LogInformation("Transaction confirmed: {TxHash}", txHash);
          return txHash;
        }

        throw new InvalidOperationException(
            $"Transaction {txHash} failed with status {receipt.Status.Value}");
      }

      await Task.Delay(1_000, ct);
    }

    throw new OperationCanceledException($"Waiting for {txHash} was cancelled");
  }

  // ──────────────────── helpers ────────────────────

  private Contract GetContract(string contractName)
  {
    var address = ResolveContractAddress(contractName);
    var abi = _abis.TryGetValue(contractName, out var a) ? a
        : throw new InvalidOperationException($"ABI not found for contract '{contractName}'");
    return _web3.Eth.GetContract(abi, address);
  }

  private string ResolveContractAddress(string contractName)
  {
    return _options.Contracts.TryGetValue(contractName, out var addr) ? addr
        : throw new InvalidOperationException($"Contract address not configured for '{contractName}'");
  }

  private void LoadAbis()
  {
    if (!Directory.Exists(_options.AbisDirectory))
    {
      _logger.LogWarning("ABIs directory not found: {Path}", _options.AbisDirectory);
      return;
    }

    foreach (var file in Directory.GetFiles(_options.AbisDirectory, "*.json"))
    {
      var name = Path.GetFileNameWithoutExtension(file);
      _abis[name] = File.ReadAllText(file);
    }

    _logger.LogInformation("Loaded {Count} contract ABIs", _abis.Count);
  }
}
