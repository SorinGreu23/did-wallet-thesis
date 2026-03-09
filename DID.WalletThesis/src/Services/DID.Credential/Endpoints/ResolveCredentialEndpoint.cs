using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class ResolveCredentialRequest
{
    public string CredentialId { get; set; } = string.Empty;
}

public class ResolveCredentialEndpoint(CredentialService service)
    : Endpoint<ResolveCredentialRequest, CredentialDto>
{
    public override void Configure()
    {
        Get("/api/credentials/{credentialId}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ResolveCredentialRequest req, CancellationToken ct)
    {
        try
        {
            await Send.OkAsync(await service.ResolveAsync(req.CredentialId, ct), ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
    }
}
