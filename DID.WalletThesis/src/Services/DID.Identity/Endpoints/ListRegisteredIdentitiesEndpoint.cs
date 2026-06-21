using DID.Identity.Application.DTOs;
using DID.Identity.Application.Services;
using FastEndpoints;

namespace DID.Identity.Endpoints;

public class ListRegisteredIdentitiesRequest
{
    public string? AccountType { get; set; }
}

public class ListRegisteredIdentitiesEndpoint(DIDService service)
    : Endpoint<ListRegisteredIdentitiesRequest, List<RegisteredIdentityDto>>
{
    public override void Configure()
    {
        Get("/api/identities");
    }

    public override async Task HandleAsync(
        ListRegisteredIdentitiesRequest req,
        CancellationToken ct)
    {
        try
        {
            var identities = await service.ListRegisteredAsync(req.AccountType, ct);
            await Send.OkAsync(identities.ToList(), ct);
        }
        catch (ArgumentException)
        {
            AddError(r => r.AccountType, "Unsupported account type.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
