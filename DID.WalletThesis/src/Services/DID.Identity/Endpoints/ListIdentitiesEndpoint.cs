using DID.Identity.Application.DTOs;
using DID.Identity.Application.Services;
using FastEndpoints;

namespace DID.Identity.Endpoints;

public class ListIdentitiesEndpoint(DIDService service) : EndpointWithoutRequest<List<RegisteredIdentityDto>>
{
    public override void Configure()
    {
        Get("/api/identities");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var identities = (await service.ListRegisteredAsync(ct)).ToList();
        await Send.OkAsync(identities, ct);
    }
}
