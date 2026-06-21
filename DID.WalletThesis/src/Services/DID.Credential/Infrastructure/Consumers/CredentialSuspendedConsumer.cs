using DID.Credential.Application.Services;
using DID.Contracts.Credential;
using MassTransit;

namespace DID.Credential.Infrastructure.Consumers;

public class CredentialSuspendedConsumer(
    ICredentialService service,
    ILogger<CredentialSuspendedConsumer> logger) : IConsumer<CredentialSuspendedEvent>
{
    public async Task Consume(ConsumeContext<CredentialSuspendedEvent> context)
    {
        var msg = context.Message;
        logger.LogInformation("Consuming CredentialSuspendedEvent for {Id}", msg.CredentialId);

        await service.RecordSuspendedAsync(
            credentialId: msg.CredentialId,
            suspendedByDid: msg.SuspendedByDID,
            blockNumber: msg.BlockNumber,
            transactionHash: msg.TransactionHash,
            timestamp: msg.Timestamp,
            ct: context.CancellationToken);
    }
}
