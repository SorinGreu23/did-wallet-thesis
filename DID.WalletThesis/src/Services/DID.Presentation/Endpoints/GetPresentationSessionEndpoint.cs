using DID.Presentation.Application.DTOs;
using DID.Presentation.Application.Services;
using FastEndpoints;

namespace DID.Presentation.Endpoints;

public class GetPresentationSessionRequest
{
    public string SessionId { get; set; } = string.Empty;
}

/// <summary>
/// GET /api/presentation/session/{sessionId}
/// Verifier polls this to retrieve the outcome of a presentation session.
/// </summary>
public class GetPresentationSessionEndpoint(PresentationService service)
    : Endpoint<GetPresentationSessionRequest, PresentationSessionDto>
{
    public override void Configure()
    {
        Get("/api/presentation/session/{sessionId}");
        AllowAnonymous();
        Description(d => d
            .WithName("GetPresentationSession")
            .WithSummary("Get the current state of a presentation session"));
    }

    public override async Task HandleAsync(GetPresentationSessionRequest req, CancellationToken ct)
    {
        var session = service.GetSession(req.SessionId);
        if (session is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(session, ct);
    }
}
