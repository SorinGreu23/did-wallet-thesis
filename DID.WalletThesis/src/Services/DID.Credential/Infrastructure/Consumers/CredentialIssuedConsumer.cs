using DID.Credential.Application.Services;
using DID.Contracts.Credential;
using MassTransit;

namespace DID.Credential.Infrastructure.Consumers;

public class CredentialIssuedConsumer(
    CredentialService service,
    ILogger<CredentialIssuedConsumer> logger) : IConsumer<CredentialIssuedEvent>
{
    public async Task Consume(ConsumeContext<CredentialIssuedEvent> context)
    {
        var msg = context.Message;
        logger.LogInformation("Consuming CredentialIssuedEvent for {Id}", msg.CredentialId);

        await service.RecordIssuedAsync(
            credentialId: msg.CredentialId,
            issuerDid: msg.IssuerDID,
            holderDid: msg.HolderDID,
            credentialType: msg.CredentialType,
            issuerAccreditationId: null,
            blockNumber: msg.BlockNumber,
            transactionHash: msg.TransactionHash,
            timestamp: msg.Timestamp,
            ct: context.CancellationToken);
    }
}
