using System;

namespace DID.Shared.Infrastructure.Options;

public class BlockchainOptions
{
  public const string SectionName = "Blockchain";

  public string RpcUrl { get; set; } = string.Empty;
  public string PrivateKey { get; set; } = string.Empty;
  public string AbisDirectory { get; set; } = string.Empty;
  public Dictionary<string, string> Contracts { get; set; } = [];
}
