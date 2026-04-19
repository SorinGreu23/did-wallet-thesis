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

    [Parameter("bytes32", "credentialHash", 4)]
    public byte[] CredentialHash { get; set; } = [];

    [Parameter("string", "credentialType", 5)]
    public string CredentialType { get; set; } = string.Empty;

    [Parameter("uint8", "status", 6)]
    public int Status { get; set; }

    [Parameter("uint256", "issuedAt", 7)]
    public System.Numerics.BigInteger IssuedAtUnix { get; set; }

    [Parameter("uint256", "expiresAt", 8)]
    public System.Numerics.BigInteger ExpiresAtUnix { get; set; }

    [Parameter("bytes32", "issuerAccreditationId", 9)]
    public byte[] IssuerAccreditationId { get; set; } = [];

    [Parameter("bool", "exists", 10)]
    public bool Exists { get; set; }
}
