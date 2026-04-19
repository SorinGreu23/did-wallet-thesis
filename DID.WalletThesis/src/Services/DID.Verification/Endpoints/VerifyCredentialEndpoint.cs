using DID.Verification.Application.DTOs;
using DID.Verification.Application.Services;
using FastEndpoints;

namespace DID.Verification.Endpoints;

/// <summary>
/// POST /api/verify/credential
///
/// Accepts a credential ID and an optional ZKP proof.
/// Returns a full trust decision: on-chain status, trust chain validity, and ZKP result.
/// </summary>
public class VerifyCredentialEndpoint(VerificationService service)
    : Endpoint<VerifyCredentialRequest, VerificationResultDto>
{
    public override void Configure()
    {
        Post("/api/verify/credential");
        AllowAnonymous();
        Description(d => d
            .WithName("VerifyCredential")
            .WithSummary("Verify a credential on-chain with optional ZKP proof")
            .WithDescription(
                "Calls CredentialRegistry.verifyCredential on-chain (which internally validates " +
                "the issuer trust chain via AccreditationRegistry). Optionally delegates a ZKP " +
                "proof to the zkp-service. Returns a combined trust decision and publishes a " +
                "VerificationCompletedEvent for audit."));
    }

    public override async Task HandleAsync(VerifyCredentialRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.CredentialId))
        {
            AddError(r => r.CredentialId, "CredentialId is required");
            ThrowIfAnyErrors();
        }

        var result = await service.VerifyAsync(req, ct);
        await Send.OkAsync(result, ct);
    }
}
