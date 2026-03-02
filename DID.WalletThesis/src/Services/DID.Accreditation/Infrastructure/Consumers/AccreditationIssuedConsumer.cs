using DID.Accreditation.Application.Services;
using DID.Contracts.Accreditation;
using MassTransit;

namespace DID.Accreditation.Infrastructure.Consumers;

public class AccreditationIssuedConsumer(
    AccreditationService service,
    ILogger<AccreditationIssuedConsumer> logger) : IConsumer<AccreditationIssuedEvent>
{
    public async Task Consume(ConsumeContext<AccreditationIssuedEvent> context)
    {
        var msg = context.Message;
        logger.LogInformation("Consuming AccreditationIssuedEvent for {Id}", msg.AccreditationId);

        await service.RecordIssuedAsync(
            accreditationId: msg.AccreditationId,
            issuerDid: msg.IssuerDID,
            subjectDid: msg.SubjectDID,
            parentAccreditationId: msg.ParentAccreditationId,
            scope: msg.Scope,
            blockNumber: msg.BlockNumber,
            transactionHash: msg.TransactionHash,
            timestamp: msg.Timestamp,
            ct: context.CancellationToken);
    }
}
