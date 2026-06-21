using DID.Identity.Application.DTOs;
using DID.Identity.Application.Services;
using FastEndpoints;

namespace DID.Identity.Endpoints;

public class RegisterIdentityEndpoint(DIDService service) : Endpoint<RegisterIdentityRequest, RegisteredIdentityDto>
{
    public override void Configure()
    {
        Post("/api/identities/register");
        AllowAnonymous();
    }

    public override async Task HandleAsync(RegisterIdentityRequest req, CancellationToken ct)
    {
        if (req.Timestamp <= 0)
        {
            AddError(r => r.Timestamp, "A valid Unix timestamp is required.");
            ThrowIfAnyErrors();
        }

        if (string.IsNullOrWhiteSpace(req.Signature))
        {
            AddError(r => r.Signature, "An ownership proof signature is required.");
            ThrowIfAnyErrors();
        }

        try
        {
            var result = await service.RegisterExternalAsync(
                req.DID, req.ControllerAddress, req.DisplayName, req.Email, req.AccountType,
                req.Timestamp, req.Signature, ct);
            await Send.OkAsync(result, cancellation: ct);
        }
        catch (ArgumentException)
        {
            AddError("Identity registration failed. The ownership proof is invalid or expired.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
