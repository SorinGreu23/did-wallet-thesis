using DID.Contracts.Accreditation;
using DID.Identity.Application.Services;
using MassTransit;

namespace DID.Identity.Infrastructure.Consumers;

public class EnterpriseRegistrationApprovedConsumer(
    DIDService service,
    ILogger<EnterpriseRegistrationApprovedConsumer> logger) : IConsumer<EnterpriseRegistrationApprovedEvent>
{
    public async Task Consume(ConsumeContext<EnterpriseRegistrationApprovedEvent> context)
    {
        var msg = context.Message;
        logger.LogInformation(
            "Registering identity for approved enterprise {RequestId}: {Name} ({Address})",
            msg.RequestId, msg.LegalName, msg.WalletAddress);

        var did = $"did:ethr:sepolia:{msg.WalletAddress.ToLowerInvariant()}";

        // Internal event — no ownership proof needed; timestamp=0 / signature=null skips the check.
        await service.RegisterExternalAsync(
            did: did,
            controllerAddress: msg.WalletAddress,
            displayName: msg.LegalName,
            email: null,
            accountType: "enterprise",
            timestamp: 0,
            signature: null,
            publicKeyHex: null,
            keyType: null,
            ct: context.CancellationToken);
    }
}
