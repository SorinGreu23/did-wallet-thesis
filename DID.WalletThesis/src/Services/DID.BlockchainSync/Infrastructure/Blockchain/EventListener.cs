using DID.BlockchainSync.Application.Handlers;
using DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;
using DID.Shared.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace DID.BlockchainSync.Infrastructure.Blockchain;

public class EventListener(
    IBlockchainService blockchainService,
    AccreditationEventHandler accreditationHandler,
    CredentialEventHandler credentialHandler,
    ILogger<EventListener> logger)
{
    public async Task StartAsync(CancellationToken ct)
    {
        logger.LogInformation("Starting blockchain event listeners");

        await Task.WhenAll(
            blockchainService.SubscribeToEventAsync<AccreditationIssuedEventDTO>(
                "AccreditationRegistry", "AccreditationIssued", accreditationHandler.HandleIssuedAsync, ct),

            blockchainService.SubscribeToEventAsync<AccreditationRevokedEventDTO>(
                "AccreditationRegistry", "AccreditationRevoked", accreditationHandler.HandleRevokedAsync, ct),

            blockchainService.SubscribeToEventAsync<CredentialIssuedEventDTO>(
                "CredentialRegistry", "CredentialIssued", credentialHandler.HandleIssuedAsync, ct),

            blockchainService.SubscribeToEventAsync<CredentialRevokedEventDTO>(
                "CredentialRegistry", "CredentialRevoked", credentialHandler.HandleRevokedAsync, ct),

            blockchainService.SubscribeToEventAsync<CredentialSuspendedEventDTO>(
                "CredentialRegistry", "CredentialSuspended", credentialHandler.HandleSuspendedAsync, ct)
        );
    }
}
