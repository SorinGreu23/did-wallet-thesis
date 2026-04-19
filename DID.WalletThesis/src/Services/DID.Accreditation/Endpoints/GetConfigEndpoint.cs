using DID.Shared.Infrastructure.Options;
using FastEndpoints;
using Microsoft.Extensions.Options;
using Nethereum.Web3.Accounts;

namespace DID.Accreditation.Endpoints;

public class GetConfigEndpoint(IOptions<BlockchainOptions> blockchainOptions)
    : EndpointWithoutRequest<GetConfigResponse>
{
    private const string DidPrefix = "did:ethr:sepolia:";

    public override void Configure()
    {
        Get("/api/config");
        AllowAnonymous();
    }

    public override Task HandleAsync(CancellationToken ct)
    {
        var opts = blockchainOptions.Value;
        var address = new Account(opts.PrivateKey).Address.ToLowerInvariant();
        var euRootDid = $"{DidPrefix}{address}";
        opts.Contracts.TryGetValue("AccreditationRegistry", out var registryAddress);
        var browserRpcUrl = string.IsNullOrWhiteSpace(opts.BrowserRpcUrl) ? opts.RpcUrl : opts.BrowserRpcUrl;
        return Send.OkAsync(new GetConfigResponse(euRootDid, browserRpcUrl, registryAddress ?? string.Empty), ct);
    }
}

public record GetConfigResponse(
    string EuRootDid,
    string RpcUrl,
    string AccreditationRegistryAddress);

