using DID.BlockchainSync.Application.Services;
using Microsoft.Extensions.Logging;

namespace DID.BlockchainSync.Workers;

public class BlockchainSyncWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<BlockchainSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("BlockchainSync Worker started");

        using var scope = scopeFactory.CreateScope();
        var eventProcessingService = scope.ServiceProvider
            .GetRequiredService<EventProcessingService>();

        try
        {
            await eventProcessingService.StartAsync(stoppingToken);
        }
        catch (OperationCanceledException ex)
        {
            logger.LogInformation(ex, "BlockchainSync Worker stopping");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "BlockchainSync Worker fatal error");
            throw;
        }
    }
}
