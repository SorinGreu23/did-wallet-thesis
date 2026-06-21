using DID.Accreditation.Application.Auth;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class AuthVerifyEndpoint(AuthService authService)
    : Endpoint<VerifyRequest, VerifyResponse>
{
    public override void Configure()
    {
        Post("/api/auth/verify");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting("auth"));
    }

    public override async Task HandleAsync(VerifyRequest req, CancellationToken ct)
    {
        try
        {
            var response = await authService.VerifyChallengeAsync(req.Did, req.Nonce, req.Signature);
            await Send.OkAsync(response, ct);
        }
        catch (UnauthorizedAccessException)
        {
            AddError("Authentication failed. Please check your credentials and try again.");
            await Send.ErrorsAsync(401, ct);
        }
        catch (ForbiddenAccessException)
        {
            AddError("You do not have permission to access this system.");
            await Send.ErrorsAsync(403, ct);
        }
    }
}
