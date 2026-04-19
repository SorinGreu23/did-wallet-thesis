using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Accreditation.Application.DTOs;

[FunctionOutput]
public class OnChainAccreditationDto
{
    [Parameter("bytes32", "id", 1)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "issuer", 2)]
    public string Issuer { get; set; } = string.Empty;

    [Parameter("address", "subject", 3)]
    public string Subject { get; set; } = string.Empty;

    [Parameter("bytes32", "parentAccreditationId", 4)]
    public byte[] ParentAccreditationId { get; set; } = [];

    [Parameter("uint8", "scope", 5)]
    public byte Scope { get; set; }

    [Parameter("bytes32", "permissionsHash", 6)]
    public byte[] PermissionsHash { get; set; } = [];

    [Parameter("uint256", "issuedAt", 7)]
    public System.Numerics.BigInteger IssuedAtUnix { get; set; }

    [Parameter("uint256", "expiresAt", 8)]
    public System.Numerics.BigInteger ExpiresAtUnix { get; set; }

    [Parameter("bool", "revoked", 9)]
    public bool Revoked { get; set; }

    [Parameter("bool", "exists", 10)]
    public bool Exists { get; set; }
}