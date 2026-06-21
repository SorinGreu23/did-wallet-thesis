using System;
using DID.Shared.Domain;

namespace DID.Identity.Domain;

public class DecentralizedIdentifier : Entity
{
  public string DID { get; set; } = string.Empty;
  public string ControllerAddress { get; set; } = string.Empty;
  public string? DisplayName { get; set; }
  public string? Email { get; set; }
  public string? AccountType { get; set; }
  public ICollection<KeyPair> KeyPairs { get; set; } = [];
}
