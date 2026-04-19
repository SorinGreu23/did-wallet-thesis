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
    }

    public override Task HandleAsync(ChallengeRequest req, CancellationToken ct)
    {
        try
        {
            var response = authService.CreateChallenge(req.Did);
            return Send.OkAsync(response, ct);
        }
        catch (ArgumentException ex)
        {
            AddError(ex.Message);
            return Send.ErrorsAsync(400, ct);
        }
    }
}
