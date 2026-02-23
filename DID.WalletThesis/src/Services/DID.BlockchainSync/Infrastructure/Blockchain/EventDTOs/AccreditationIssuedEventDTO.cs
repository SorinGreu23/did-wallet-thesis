using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;

[Event("AccreditationIssued")]
public class AccreditationIssuedEventDTO : IEventDTO
{
    [Parameter("bytes32", "id", 1, true)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "issuer", 2, true)]
    public string Issuer { get; set; } = string.Empty;

    [Parameter("address", "subject", 3, true)]
    public string Subject { get; set; } = string.Empty;

    [Parameter("uint8", "scope", 4, false)]
    public byte Scope { get; set; }

    [Parameter("bytes32", "parentAccreditationId", 5, false)]
    public byte[] ParentAccreditationId { get; set; } = [];
}
