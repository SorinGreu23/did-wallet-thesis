using Nethereum.ABI.FunctionEncoding.Attributes;
using System.Numerics;

namespace DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;

[Event("CredentialSuspended")]
public class CredentialSuspendedEventDTO : IEventDTO
{
    [Parameter("bytes32", "id", 1, true)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "suspendedBy", 2, true)]
    public string SuspendedBy { get; set; } = string.Empty;

    [Parameter("uint256", "suspendedAt", 3, false)]
    public BigInteger SuspendedAt { get; set; }

    [Parameter("string", "reason", 4, false)]
    public string Reason { get; set; } = string.Empty;
}
