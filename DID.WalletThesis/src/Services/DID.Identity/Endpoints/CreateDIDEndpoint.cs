using DID.Identity.Application.DTOs;
using DID.Identity.Application.Services;
using FastEndpoints;

namespace DID.Identity.Endpoints;

public class CreateDIDEndpoint(DIDService service) : Endpoint<CreateDIDRequest, DIDDocumentDto>
{
    public override void Configure()
    {
        Post("/api/dids");
        AllowAnonymous();
    }

    public override async Task HandleAsync(CreateDIDRequest req, CancellationToken ct)
    {
        try
        {
            var doc = await service.CreateDIDAsync(req.ControllerAddress, ct);
            await Send.CreatedAtAsync<ResolveDIDEndpoint>(new { did = doc.Id }, doc, cancellation: ct);
        }
        catch (InvalidOperationException ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(409, ct);
        }
    }
}
