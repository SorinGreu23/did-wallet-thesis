using DID.Presentation.Application.DTOs;
using DID.Presentation.Application.Services;
using FastEndpoints;

namespace DID.Presentation.Endpoints;

/// <summary>
/// POST /api/presentation/request
/// Verifier creates a presentation challenge (nonce + session ID).
/// </summary>
public class CreatePresentationRequestEndpoint(PresentationService service)
    : Endpoint<CreatePresentationRequestDto, PresentationChallengeDto>
{
    public override void Configure()
    {
        Post("/api/presentation/request");
        AllowAnonymous();
        Description(d => d
            .WithName("CreatePresentationRequest")
            .WithSummary("Create a presentation challenge")
            .WithDescription(
                "The verifier calls this to obtain a session ID and nonce. " +
                "These are typically encoded in a QR code for the wallet to scan."));
    }

    public override async Task HandleAsync(CreatePresentationRequestDto req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.VerifierDid))
        {
            AddError(r => r.VerifierDid, "VerifierDid is required");
            ThrowIfAnyErrors();
        }

        if (req.RequiredCredentialTypes is null || req.RequiredCredentialTypes.Length == 0)
        {
            AddError(r => r.RequiredCredentialTypes, "At least one RequiredCredentialType is required");
            ThrowIfAnyErrors();
        }

        var challenge = service.CreateChallenge(req);
        await Send.CreatedAtAsync<GetPresentationSessionEndpoint>(
            new { sessionId = challenge.SessionId },
            challenge,
            cancellation: ct);
    }
}
