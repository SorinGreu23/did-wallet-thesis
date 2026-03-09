using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class ListCredentialsRequest
{
    public string? IssuerDid { get; set; }
    public string? HolderDid { get; set; }
}

public class ListCredentialsEndpoint(CredentialService service)
    : Endpoint<ListCredentialsRequest, List<CredentialDto>>
{
    public override void Configure()
    {
        Get("/api/credentials");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ListCredentialsRequest req, CancellationToken ct)
    {
        var results = await service.ListAsync(req.IssuerDid, req.HolderDid, ct);
        await Send.OkAsync(results.ToList(), ct);
    }
}
