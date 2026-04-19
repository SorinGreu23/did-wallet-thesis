using DID.Shared.Infrastructure.Options;
using FastEndpoints;
using Microsoft.Extensions.Options;

namespace DID.Credential.Endpoints;

public class GetCredentialConfigEndpoint(IOptions<BlockchainOptions> blockchainOptions)
    : EndpointWithoutRequest<GetCredentialConfigResponse>
{
    public override void Configure()
    {
        Get("/api/credentials/config");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        var opts = blockchainOptions.Value;
        opts.Contracts.TryGetValue("CredentialRegistry", out var registryAddress);
        var browserRpcUrl = string.IsNullOrWhiteSpace(opts.BrowserRpcUrl) ? opts.RpcUrl : opts.BrowserRpcUrl;
        return Send.OkAsync(new GetCredentialConfigResponse(browserRpcUrl, registryAddress ?? string.Empty), ct);
    }
}

public record GetCredentialConfigResponse(
    string RpcUrl,
    string CredentialRegistryAddress);
