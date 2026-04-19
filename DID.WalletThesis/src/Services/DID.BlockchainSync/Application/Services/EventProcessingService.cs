using DID.BlockchainSync.Infrastructure.Blockchain;
using Microsoft.Extensions.Logging;

namespace DID.BlockchainSync.Application.Services;

public class EventProcessingService(
    EventListener eventListener,
    ILogger<EventProcessingService> logger)
{
    public async Task StartAsync(CancellationToken ct)
    {
        logger.LogInformation("EventProcessingService starting");
        await eventListener.StartAsync(ct);
    }
}
