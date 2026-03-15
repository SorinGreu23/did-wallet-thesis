using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class RevokeCredentialRequest
{
    public string CredentialId { get; set; } = string.Empty;
    public string RevokedByDID { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? RevokedByPrivateKey { get; set; }
}

public class RevokeCredentialEndpoint(CredentialService service)
    : Endpoint<RevokeCredentialRequest>
{
    public override void Configure()
    {
        Post("/api/credentials/{credentialId}/revoke");
        AllowAnonymous();
    }

    public override async Task HandleAsync(RevokeCredentialRequest req, CancellationToken ct)
    {
        var found = await service.RevokeAsync(req.CredentialId, req.RevokedByDID, req.Reason, req.RevokedByPrivateKey, ct);
        if (!found)
            await Send.NotFoundAsync(ct);
        else
            await Send.NoContentAsync(ct);
    }
}
