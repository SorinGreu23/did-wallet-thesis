using DID.Identity.Application.DTOs;
using DID.Identity.Application.Services;
using FastEndpoints;

namespace DID.Identity.Endpoints;

public class GetDIDKeysRequest
{
    public string Did { get; set; } = string.Empty;
}

public class GetDIDKeysEndpoint(DIDService service) : Endpoint<GetDIDKeysRequest, List<PublicKeyDto>>
{
    public override void Configure()
    {
        Get("/api/dids/{did}/keys");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetDIDKeysRequest req, CancellationToken ct)
    {
        try
        {
            var keys = (await service.GetPublicKeysAsync(req.Did, ct)).ToList();
            await Send.OkAsync(keys, ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
    }
}
