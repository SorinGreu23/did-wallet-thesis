using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nethereum.Web3;
using Nethereum.Web3.Accounts;

namespace DID.Shared.Infrastructure.Blockchain;

public class BlockchainService : IBlockchainService
{
  private readonly Web3 _web3;
  private readonly BlockchainOptions _options;
  private readonly ILogger<BlockchainService> _logger;
  private readonly Dictionary<string, string> _abis = [];

  public BlockchainService(IOptions<BlockchainOptions> options, ILogger<BlockchainService> logger)
  {
    _options = options.Value;
    _logger = logger;

    var account = new Account(_options.PrivateKey);
    _web3 = new Web3(account, _options.RpcUrl);

    LoadAbis();
  }

  public Task<T> CallContractAsync<T>(string contractName, string functionName, params object[] args)
  {
    throw new NotImplementedException();
  }

  public Task<string> SubmitTransactionAsync<T>(string contractName, string functionName, params object[] args)
  {
    throw new NotImplementedException();
  }

  public Task SubscribeToEventAsync<TEvent>(string contractName, string eventName, Func<TEvent, Task> handler, CancellationToken ct = default) where TEvent : class, new()
  {
    throw new NotImplementedException();
  }

  public Task<string> WaitForConfirmationAsync(string txHash, CancellationToken ct = default)
  {
    throw new NotImplementedException();
  }

  private void LoadAbis()
  {
    if(!Directory.Exists(_options.AbisDirectory))
    {
      _logger.LogWarning("ABIs directory not found: {Path}", _options.AbisDirectory);
      return;
    }

    foreach(var file in Directory.GetFiles(_options.AbisDirectory, "*.json"))
    {
      var name = Path.GetFileNameWithoutExtension(file);
      _abis[name] = File.ReadAllText(file);
    }

    _logger.LogInformation("Loaded {Count} contract ABIs", _abis.Count);
  }
}
