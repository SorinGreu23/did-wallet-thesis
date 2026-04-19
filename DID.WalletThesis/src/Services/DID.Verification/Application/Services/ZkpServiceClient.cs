using System.Net.Http.Json;
using System.Text.Json;

namespace DID.Verification.Application.Services;

/// <summary>
/// HTTP client that delegates ZKP proof verification to the zkp-service.
/// POST /zkp/verify → { valid: bool }
/// </summary>
public class ZkpServiceClient(HttpClient httpClient, ILogger<ZkpServiceClient> logger)
{
    public async Task<bool> VerifyProofAsync(
        string circuitName,
        JsonElement proof,
        string[] publicSignals,
        CancellationToken ct = default)
    {
        var payload = new { circuitName, proof, publicSignals };

        var response = await httpClient.PostAsJsonAsync("/zkp/verify", payload, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<ZkpVerifyResponse>(
            cancellationToken: ct);

        logger.LogInformation(
            "ZKP proof verified for circuit {Circuit}: valid={Valid}",
            circuitName, result?.Valid);

        return result?.Valid ?? false;
    }

    private sealed record ZkpVerifyResponse(bool Valid);
}
