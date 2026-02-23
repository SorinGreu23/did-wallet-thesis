using Nethereum.ABI.FunctionEncoding.Attributes;
using System.Numerics;

namespace DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;

[Event("AccreditationRevoked")]
public class AccreditationRevokedEventDTO : IEventDTO
{
    [Parameter("bytes32", "id", 1, true)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "revokedBy", 2, true)]
    public string RevokedBy { get; set; } = string.Empty;

    [Parameter("uint256", "revokedAt", 3, false)]
    public BigInteger RevokedAt { get; set; }
}
