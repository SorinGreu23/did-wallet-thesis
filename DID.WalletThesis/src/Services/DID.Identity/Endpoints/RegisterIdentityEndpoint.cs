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
        var result = await service.RegisterExternalAsync(
            req.DID, req.ControllerAddress, req.DisplayName, req.Email, ct);
        await Send.CreatedAtAsync<ListIdentitiesEndpoint>(null, result, cancellation: ct);
    }
}
