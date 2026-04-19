using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class VerifyCredentialRequest
{
    public string CredentialId { get; set; } = string.Empty;
}

public class VerifyCredentialEndpoint(CredentialService service)
    : Endpoint<VerifyCredentialRequest, CredentialVerificationDto>
{
    public override void Configure()
    {
        Get("/api/credentials/{credentialId}/verify");
        AllowAnonymous();
    }

    public override async Task HandleAsync(VerifyCredentialRequest req, CancellationToken ct)
    {
        var result = await service.VerifyAsync(req.CredentialId, ct);
        await Send.OkAsync(result, ct);
    }
}
