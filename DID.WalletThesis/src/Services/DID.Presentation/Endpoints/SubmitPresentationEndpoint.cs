using DID.Presentation.Application.DTOs;
using DID.Presentation.Application.Services;
using FastEndpoints;

namespace DID.Presentation.Endpoints;

/// <summary>
/// POST /api/presentation/submit
/// Wallet submits a list of credential IDs (and optional ZKP proof) in response to a challenge.
/// DID.Presentation delegates each credential to DID.Verification for on-chain trust checks.
/// </summary>
public class SubmitPresentationEndpoint(PresentationService service)
    : Endpoint<SubmitPresentationDto, PresentationSessionDto>
{
    public override void Configure()
    {
        Post("/api/presentation/submit");
        AllowAnonymous();
        Description(d => d
            .WithName("SubmitPresentation")
            .WithSummary("Submit a verifiable presentation")
            .WithDescription(
                "The wallet calls this with the session ID, the on-chain credential IDs " +
                "being presented, and an optional ZKP proof. Each credential is verified " +
                "on-chain via DID.Verification. The session outcome is stored and can be " +
                "polled by the verifier via GET /api/presentation/session/{sessionId}."));
    }

    public override async Task HandleAsync(SubmitPresentationDto req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.SessionId))
        {
            AddError(r => r.SessionId, "SessionId is required");
            ThrowIfAnyErrors();
        }

        if (req.CredentialIds is null || req.CredentialIds.Length == 0)
        {
            AddError(r => r.CredentialIds, "At least one CredentialId is required");
            ThrowIfAnyErrors();
        }

        try
        {
            var result = await service.SubmitAsync(req, ct);
            await Send.OkAsync(result, ct);
        }
        catch (KeyNotFoundException ex)
        {
            await Send.NotFoundAsync(ct);
            _ = ex;
        }
        catch (InvalidOperationException ex)
        {
            AddError(ex.Message);
            ThrowIfAnyErrors();
        }
    }
}
