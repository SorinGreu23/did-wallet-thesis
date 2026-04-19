using System.Security.Claims;
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
        var callerDid = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");
        var callerScope = User.FindFirstValue("scope") ?? "";
        var isAuthenticated = User.Identity?.IsAuthenticated == true;

        // Unauthenticated callers (e.g. mobile wallet) must provide holderDid
        if (!isAuthenticated)
        {
            if (string.IsNullOrWhiteSpace(req.HolderDid))
            {
                await Send.UnauthorizedAsync(ct);
                return;
            }

            var results = await service.ListAsync(null, req.HolderDid, ct);
            await Send.OkAsync(results.ToList(), ct);
            return;
        }

        // Institution users can only see their own credentials
        var effectiveIssuerDid = req.IssuerDid;
        if (callerScope.Equals("Institution", StringComparison.OrdinalIgnoreCase) && callerDid is not null)
            effectiveIssuerDid = callerDid;

        var results2 = await service.ListAsync(effectiveIssuerDid, req.HolderDid, ct);
        await Send.OkAsync(results2.ToList(), ct);
    }
}
