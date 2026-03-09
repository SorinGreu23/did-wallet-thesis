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
        var address = new Account(blockchainOptions.Value.PrivateKey).Address.ToLowerInvariant();
        var euRootDid = $"{DidPrefix}{address}";
        return Send.OkAsync(new GetConfigResponse(euRootDid), ct);
    }
}

public record GetConfigResponse(string EuRootDid);

