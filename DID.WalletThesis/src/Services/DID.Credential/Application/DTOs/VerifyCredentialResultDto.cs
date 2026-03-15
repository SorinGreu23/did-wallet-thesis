using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Credential.Application.DTOs;

[FunctionOutput]
public class VerifyCredentialResultDto
{
    [Parameter("bool", "isValid", 1)]
    public bool IsValid { get; set; }

    [Parameter("uint8", "status", 2)]
    public int Status { get; set; }

    [Parameter("bool", "trustChainValid", 3)]
    public bool TrustChainValid { get; set; }
}