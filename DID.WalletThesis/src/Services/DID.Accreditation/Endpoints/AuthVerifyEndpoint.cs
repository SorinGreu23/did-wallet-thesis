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
    }

    public override async Task HandleAsync(VerifyRequest req, CancellationToken ct)
    {
        try
        {
            var response = await authService.VerifyChallengeAsync(req.Did, req.Nonce, req.Signature);
            await Send.OkAsync(response, ct);
        }
        catch (UnauthorizedAccessException ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(401, ct);
        }
        catch (ForbiddenAccessException ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(403, ct);
        }
    }
}
