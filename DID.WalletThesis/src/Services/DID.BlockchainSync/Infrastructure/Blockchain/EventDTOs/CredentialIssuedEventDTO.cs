using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;

[Event("CredentialIssued")]
public class CredentialIssuedEventDTO : IEventDTO
{
    [Parameter("bytes32", "id", 1, true)]
    public byte[] Id { get; set; } = [];

    [Parameter("address", "issuer", 2, true)]
    public string Issuer { get; set; } = string.Empty;

    [Parameter("address", "holder", 3, true)]
    public string Holder { get; set; } = string.Empty;

    [Parameter("string", "credentialType", 4, false)]
    public string CredentialType { get; set; } = string.Empty;

    [Parameter("bytes32", "issuerAccreditationId", 5, false)]
    public byte[] IssuerAccreditationId { get; set; } = [];
}
