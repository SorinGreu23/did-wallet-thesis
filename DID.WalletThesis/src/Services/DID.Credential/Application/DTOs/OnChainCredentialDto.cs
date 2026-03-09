using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Credential.Application.DTOs;

[FunctionOutput]
public class OnChainCredentialDto
{
    [Parameter("bytes32", "id", 1)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "issuer", 2)]
    public string Issuer { get; set; } = string.Empty;

    [Parameter("address", "holder", 3)]
    public string Holder { get; set; } = string.Empty;

    [Parameter("string", "credentialType", 4)]
    public string CredentialType { get; set; } = string.Empty;

    [Parameter("bytes32", "issuerAccreditationId", 5)]
    public byte[] IssuerAccreditationId { get; set; } = [];

    [Parameter("uint256", "issuedAt", 6)]
    public System.Numerics.BigInteger IssuedAtUnix { get; set; }

    [Parameter("uint256", "expiresAt", 7)]
    public System.Numerics.BigInteger ExpiresAtUnix { get; set; }

    [Parameter("bool", "revoked", 8)]
    public bool Revoked { get; set; }

    [Parameter("bool", "suspended", 9)]
    public bool Suspended { get; set; }

    [Parameter("bool", "exists", 10)]
    public bool Exists { get; set; }
}
