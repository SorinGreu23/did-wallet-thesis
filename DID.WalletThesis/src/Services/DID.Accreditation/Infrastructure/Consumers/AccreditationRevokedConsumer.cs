using DID.Accreditation.Application.Services;
using DID.Contracts.Accreditation;
using MassTransit;

namespace DID.Accreditation.Infrastructure.Consumers;

public class AccreditationRevokedConsumer(
    AccreditationService service,
    ILogger<AccreditationRevokedConsumer> logger) : IConsumer<AccreditationRevokedEvent>
{
    public async Task Consume(ConsumeContext<AccreditationRevokedEvent> context)
    {
        var msg = context.Message;
        logger.LogInformation("Consuming AccreditationRevokedEvent for {Id}", msg.AccreditationId);

        await service.RecordRevokedAsync(
            accreditationId: msg.AccreditationId,
            revokedByDid: msg.RevokedByDID,
            blockNumber: msg.BlockNumber,
            transactionHash: msg.TransactionHash,
            timestamp: msg.Timestamp,
            ct: context.CancellationToken);
    }
}
