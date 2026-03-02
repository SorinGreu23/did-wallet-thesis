using System;
using DID.Shared.Domain;

namespace DID.Identity.Domain;

public class KeyPair : Entity
{
  public Guid DIDId { get; set; }
  public string KeyType { get; set; } = string.Empty;
  public string PublicKey { get; set; } = string.Empty;
  public string EncryptedPrivateKey { get; set; } = string.Empty;
  public string Purpose { get; set; } = string.Empty;

  public DecentralizedIdentifier DecentralizedIdentifier { get; set; } = null;
}
