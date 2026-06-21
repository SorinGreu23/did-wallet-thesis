using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class IssueCredentialEndpoint(ICredentialService service)
    : Endpoint<IssueCredentialRequest, CredentialDto>
{
    public override void Configure()
    {
        Post("/api/credentials");
        Policies("Institution");
    }

    public override async Task HandleAsync(IssueCredentialRequest req, CancellationToken ct)
    {
        var result = await service.IssueAsync(
            req.IssuerDID,
            req.HolderDID,
            req.CredentialType,
            req.CredentialHash,
            req.IssuerAccreditationId,
            req.IssuerName,
            req.ExpiresAt,
            ct);
        await Send.OkAsync(result, cancellation: ct);
    }
}
