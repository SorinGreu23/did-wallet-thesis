using DID.Contracts.Verification;
using DID.Shared.Application.Interfaces;
using DID.Verification.Application.DTOs;
using MassTransit;

namespace DID.Verification.Application.Services;

/// <summary>
/// Orchestrates on-chain credential verification, optional ZKP proof delegation,
/// and audit event publishing.
///
/// Flow:
///   1. Call CredentialRegistry.verifyCredential on-chain
///      → returns (isValid, status, trustChainValid)
///      (the contract internally calls AccreditationRegistry.validateTrustChain,
///       so trustChainValid covers the full issuer accreditation chain)
///   2. If a ZKP proof is supplied, delegate to the zkp-service via HTTP
///   3. Combine results and publish a VerificationCompletedEvent for audit
/// </summary>
public class VerificationService(
    IBlockchainService blockchain,
    ZkpServiceClient zkpClient,
    IPublishEndpoint publishEndpoint,
    ILogger<VerificationService> logger)
{
    public async Task<VerificationResultDto> VerifyAsync(
        VerifyCredentialRequest request,
        CancellationToken ct = default)
    {
        // 1. On-chain verification
        VerifyCredentialOnChainResult onChain;
        try
        {
            onChain = await blockchain.CallContractAsync<VerifyCredentialOnChainResult>(
                "CredentialRegistry",
                "verifyCredential",
                HexToBytes32(request.CredentialId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "On-chain verification call failed for credential {Id}", request.CredentialId);
            return new VerificationResultDto(
                request.CredentialId,
                IsValid: false,
                CredentialActive: false,
                TrustChainValid: false,
                ZkpValid: null,
                Status: "Error",
                Reason: "On-chain verification call failed",
                VerifiedAt: DateTime.UtcNow);
        }

        // 2. Optional ZKP proof verification
        bool? zkpValid = null;
        if (request.ZkpProof is not null)
        {
            try
            {
                zkpValid = await zkpClient.VerifyProofAsync(
                    request.ZkpProof.CircuitName,
                    request.ZkpProof.Proof,
                    request.ZkpProof.PublicSignals,
                    ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "ZKP service call failed for credential {Id}", request.CredentialId);
                zkpValid = false;
            }
        }

        // 3. Compute overall result
        var credentialActive = onChain.Status == 0; // CredentialStatus.Active
        var isValid = onChain.IsValid && (zkpValid ?? true);
        var status = MapStatus(onChain.Status);

        var reason = isValid
            ? null
            : status switch
            {
                "Revoked"   => "Credential has been revoked on-chain",
                "Suspended" => "Credential has been suspended on-chain",
                "Expired"   => "Credential has expired",
                _ when !onChain.TrustChainValid => "Issuer trust chain is no longer valid",
                _ when zkpValid == false         => "ZKP proof verification failed",
                _                                => "Credential is not valid"
            };

        var result = new VerificationResultDto(
            request.CredentialId,
            isValid,
            credentialActive,
            onChain.TrustChainValid,
            zkpValid,
            status,
            reason,
            VerifiedAt: DateTime.UtcNow);

        // 4. Publish audit event (fire-and-forget failure is acceptable)
        try
        {
            await publishEndpoint.Publish(new VerificationCompletedEvent(
                SessionId: Guid.NewGuid().ToString(),
                VerifierDID: request.VerifierDid ?? string.Empty,
                HolderDID: string.Empty,
                OverallValid: isValid,
                SignatureValid: true,
                CredentialActive: credentialActive,
                TrustChainValid: onChain.TrustChainValid,
                ZkpValid: zkpValid,
                VerifiedAt: result.VerifiedAt), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish VerificationCompletedEvent for credential {Id}", request.CredentialId);
        }

        logger.LogInformation(
            "Credential {Id} verified: valid={IsValid}, status={Status}, trustChain={TrustChain}, zkp={Zkp}",
            request.CredentialId, isValid, status, onChain.TrustChainValid, zkpValid);

        return result;
    }

    private static byte[] HexToBytes32(string hex)
    {
        var clean = hex.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? hex[2..] : hex;
        if (clean.Length == 0) return new byte[32];
        var bytes = Convert.FromHexString(clean.PadLeft(64, '0'));
        return bytes.Length == 32 ? bytes : bytes[^32..];
    }

    private static string MapStatus(int status) => status switch
    {
        0 => "Active",
        1 => "Revoked",
        2 => "Suspended",
        3 => "Expired",
        _ => "Unknown"
    };
}
