using DID.Accreditation.Application.Auth;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class AuthChallengeEndpoint(AuthService authService)
    : Endpoint<ChallengeRequest, ChallengeResponse>
{
    public override void Configure()
    {
        Post("/api/auth/challenge");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting("auth"));
    }

    public override Task HandleAsync(ChallengeRequest req, CancellationToken ct)
    {
        try
        {
            var response = authService.CreateChallenge(req.Did);
            return Send.OkAsync(response, ct);
        }
        catch (ArgumentException)
        {
            AddError("The provided DID is invalid or not recognized.");
            return Send.ErrorsAsync(400, ct);
        }
    }
}
