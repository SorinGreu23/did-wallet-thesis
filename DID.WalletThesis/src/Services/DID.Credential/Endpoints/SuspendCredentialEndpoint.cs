using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class SuspendCredentialRequest
{
    public string CredentialId { get; set; } = string.Empty;
    public string SuspendedByDID { get; set; } = string.Empty;
}

public class SuspendCredentialEndpoint(CredentialService service)
    : Endpoint<SuspendCredentialRequest>
{
    public override void Configure()
    {
        Patch("/api/credentials/{credentialId}/suspend");
        AllowAnonymous();
    }

    public override async Task HandleAsync(SuspendCredentialRequest req, CancellationToken ct)
    {
        var found = await service.SuspendAsync(req.CredentialId, req.SuspendedByDID, ct);
        if (!found)
            await Send.NotFoundAsync(ct);
        else
            await Send.NoContentAsync(ct);
    }
}
