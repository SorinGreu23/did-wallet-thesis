using System.Net.Http.Json;
using System.Text.Json;
using DID.Presentation.Application.DTOs;

namespace DID.Presentation.Application.Services;

/// <summary>
/// Typed HTTP client for DID.Verification POST /api/verify/credential.
/// </summary>
public class VerificationServiceClient(
    HttpClient httpClient,
    ILogger<VerificationServiceClient> logger)
{
    public async Task<CredentialVerificationResultDto> VerifyAsync(
        string credentialId,
        string? verifierDid,
        ZkpProofDto? zkpProof,
        CancellationToken ct = default)
    {
        var payload = new
        {
            credentialId,
            verifierDid,
            zkpProof = zkpProof is null ? null : new
            {
                circuitName = zkpProof.CircuitName,
                proof = zkpProof.Proof,
                publicSignals = zkpProof.PublicSignals,
            }
        };

        var response = await httpClient.PostAsJsonAsync("/api/verify/credential", payload, ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "DID.Verification returned {Status} for credential {Id}",
                response.StatusCode, credentialId);

            return new CredentialVerificationResultDto(
                credentialId,
                IsValid: false,
                CredentialActive: false,
                TrustChainValid: false,
                ZkpValid: null,
                Status: "Error",
                Reason: $"Verification service returned {(int)response.StatusCode}");
        }

        var result = await response.Content.ReadFromJsonAsync<VerificationResponse>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
            ct);

        return new CredentialVerificationResultDto(
            credentialId,
            result?.IsValid ?? false,
            result?.CredentialActive ?? false,
            result?.TrustChainValid ?? false,
            result?.ZkpValid,
            result?.Status ?? "Unknown",
            result?.Reason);
    }

    private sealed record VerificationResponse(
        string CredentialId,
        bool IsValid,
        bool CredentialActive,
        bool TrustChainValid,
        bool? ZkpValid,
        string Status,
        string? Reason,
        DateTime VerifiedAt);
}
