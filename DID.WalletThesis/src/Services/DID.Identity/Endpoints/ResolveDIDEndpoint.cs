using DID.Identity.Application.DTOs;
using DID.Identity.Application.Services;
using FastEndpoints;

namespace DID.Identity.Endpoints;

public class ResolveDIDRequest
{
    public string Did { get; set; } = string.Empty;
}

public class ResolveDIDEndpoint(DIDService service) : Endpoint<ResolveDIDRequest, DIDDocumentDto>
{
    public override void Configure()
    {
        Get("/api/dids/{did}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ResolveDIDRequest req, CancellationToken ct)
    {
        try
        {
            await Send.OkAsync(await service.ResolveDIDAsync(req.Did, ct), ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
    }
}
