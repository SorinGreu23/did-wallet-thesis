using DID.Credential.Application.Services;
using DID.Contracts.Credential;
using MassTransit;

namespace DID.Credential.Infrastructure.Consumers;

public class CredentialRevokedConsumer(
    ICredentialService service,
    ILogger<CredentialRevokedConsumer> logger) : IConsumer<CredentialRevokedEvent>
{
    public async Task Consume(ConsumeContext<CredentialRevokedEvent> context)
    {
        var msg = context.Message;
        logger.LogInformation("Consuming CredentialRevokedEvent for {Id}", msg.CredentialId);

        await service.RecordRevokedAsync(
            credentialId: msg.CredentialId,
            revokedByDid: msg.RevokedByDID,
            reason: msg.Reason,
            blockNumber: msg.BlockNumber,
            transactionHash: msg.TransactionHash,
            timestamp: msg.Timestamp,
            ct: context.CancellationToken);
    }
}
