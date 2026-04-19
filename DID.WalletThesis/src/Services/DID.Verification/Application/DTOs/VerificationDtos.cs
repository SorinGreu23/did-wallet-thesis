using System.Text.Json;
using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DID.Verification.Application.DTOs;

public record ZkpProofDto(
    string CircuitName,
    JsonElement Proof,
    string[] PublicSignals);

public record VerifyCredentialRequest(
    string CredentialId,
    string? VerifierDid = null,
    ZkpProofDto? ZkpProof = null);

public record VerificationResultDto(
    string CredentialId,
    bool IsValid,
    bool CredentialActive,
    bool TrustChainValid,
    bool? ZkpValid,
    string Status,
    string? Reason,
    DateTime VerifiedAt);

/// <summary>
/// Nethereum ABI output mapping for CredentialRegistry.verifyCredential()
/// which returns (bool isValid, uint8 status, bool trustChainValid).
/// </summary>
[FunctionOutput]
public class VerifyCredentialOnChainResult
{
    [Parameter("bool", "isValid", 1)]
    public bool IsValid { get; set; }

    [Parameter("uint8", "status", 2)]
    public int Status { get; set; }

    [Parameter("bool", "trustChainValid", 3)]
    public bool TrustChainValid { get; set; }
}
