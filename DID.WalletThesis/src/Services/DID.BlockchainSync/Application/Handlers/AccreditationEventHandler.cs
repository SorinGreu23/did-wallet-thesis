using System.Text.Json;
using DID.BlockchainSync.Domain.Entities;
using DID.BlockchainSync.Domain.Interfaces;
using DID.BlockchainSync.Infrastructure.Blockchain.EventDTOs;
using DID.Contracts.Accreditation;
using DID.Shared.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace DID.BlockchainSync.Application.Handlers;

public class AccreditationEventHandler(
    ISyncRepository repository,
    IEventBus eventBus,
    ILogger<AccreditationEventHandler> logger)
{
    public async Task HandleIssuedAsync(AccreditationIssuedEventDTO dto)
    {
        var id = ToHex(dto.Id);
        var parentId = dto.ParentAccreditationId.Any(b => b != 0)
            ? ToHex(dto.ParentAccreditationId)
            : null;
        var scope = dto.Scope switch
        {
            1 => "MemberState",
            2 => "Ministry",
            3 => "Institution",
            4 => "Department",
            _ => "None"
        };

        logger.LogInformation("AccreditationIssued: {Id}", id);

        var syncedEvent = SyncedEvent.Create(
            "AccreditationIssued", string.Empty, 0, string.Empty,
            JsonSerializer.Serialize(dto));

        await repository.SaveEventAsync(syncedEvent);

        await eventBus.PublishAsync(new AccreditationIssuedEvent(
            AccreditationId:       id,
            IssuerDID:             dto.Issuer,
            SubjectDID:            dto.Subject,
            ParentAccreditationId: parentId,
            Scope:                 scope,
            BlockNumber:           0,
            TransactionHash:       string.Empty,
            Timestamp:             DateTime.UtcNow));

        await repository.MarkEventPublishedAsync(syncedEvent.Id);
    }

    public async Task HandleRevokedAsync(AccreditationRevokedEventDTO dto)
    {
        var id = ToHex(dto.Id);
        logger.LogInformation("AccreditationRevoked: {Id}", id);

        var syncedEvent = SyncedEvent.Create(
            "AccreditationRevoked", string.Empty, 0, string.Empty,
            JsonSerializer.Serialize(dto));

        await repository.SaveEventAsync(syncedEvent);

        await eventBus.PublishAsync(new AccreditationRevokedEvent(
            AccreditationId: id,
            RevokedByDID:    dto.RevokedBy,
            BlockNumber:     (long)dto.RevokedAt,
            TransactionHash: string.Empty,
            Timestamp:       DateTime.UtcNow));

        await repository.MarkEventPublishedAsync(syncedEvent.Id);
    }

    private static string ToHex(byte[] bytes) => "0x" + Convert.ToHexString(bytes).ToLower();
}
