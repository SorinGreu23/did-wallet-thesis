using System.Text.Json;
using DID.BlockchainSync.Domain.Entities;
using DID.BlockchainSync.Domain.Interfaces;
using DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;
using DID.Contracts.Credential;
using DID.Shared.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace DID.BlockchainSync.Application.Handlers;

public class CredentialEventHandler(
    ISyncRepository repository,
    IEventBus eventBus,
    ILogger<CredentialEventHandler> logger)
{
    public async Task HandleIssuedAsync(CredentialIssuedEventDTO dto)
    {
        var id = ToHex(dto.Id);
        logger.LogInformation("CredentialIssued: {Id}", id);

        var syncedEvent = SyncedEvent.Create(
            "CredentialIssued", string.Empty, 0, string.Empty,
            JsonSerializer.Serialize(dto));

        await repository.SaveEventAsync(syncedEvent);

        await eventBus.PublishAsync(new CredentialIssuedEvent(
            CredentialId:    id,
            IssuerDID:       dto.Issuer,
            HolderDID:       dto.Holder,
            CredentialType:  dto.CredentialType,
            IssuerAccreditationId: ToHex(dto.IssuerAccreditationId),
            BlockNumber:     0,
            TransactionHash: string.Empty,
            Timestamp:       DateTime.UtcNow));

        await repository.MarkEventPublishedAsync(syncedEvent.Id);
    }

    public async Task HandleRevokedAsync(CredentialRevokedEventDTO dto)
    {
        var id = ToHex(dto.Id);
        logger.LogInformation("CredentialRevoked: {Id}", id);

        var syncedEvent = SyncedEvent.Create(
            "CredentialRevoked", string.Empty, 0, string.Empty,
            JsonSerializer.Serialize(dto));

        await repository.SaveEventAsync(syncedEvent);

        await eventBus.PublishAsync(new CredentialRevokedEvent(
            CredentialId:    id,
            RevokedByDID:    dto.RevokedBy,
            Reason:          dto.Reason,
            BlockNumber:     (long)dto.RevokedAt,
            TransactionHash: string.Empty,
            Timestamp:       DateTime.UtcNow));

        await repository.MarkEventPublishedAsync(syncedEvent.Id);
    }

    public async Task HandleSuspendedAsync(CredentialSuspendedEventDTO dto)
    {
        var id = ToHex(dto.Id);
        logger.LogInformation("CredentialSuspended: {Id}", id);

        var syncedEvent = SyncedEvent.Create(
            "CredentialSuspended", string.Empty, 0, string.Empty,
            JsonSerializer.Serialize(dto));

        await repository.SaveEventAsync(syncedEvent);

        await eventBus.PublishAsync(new CredentialSuspendedEvent(
            CredentialId:    id,
            SuspendedByDID:  dto.SuspendedBy,
            BlockNumber:     (long)dto.SuspendedAt,
            TransactionHash: string.Empty,
            Timestamp:       DateTime.UtcNow));

        await repository.MarkEventPublishedAsync(syncedEvent.Id);
    }

    private static string ToHex(byte[] bytes) => "0x" + Convert.ToHexString(bytes).ToLower();
}
