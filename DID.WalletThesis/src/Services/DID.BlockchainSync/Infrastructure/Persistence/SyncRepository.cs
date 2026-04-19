using DID.BlockchainSync.Domain.Entities;
using DID.BlockchainSync.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DID.BlockchainSync.Infrastructure.Persistence;

public class SyncRepository(SyncDbContext context) : ISyncRepository
{
    public async Task<long> GetLastSyncedBlockAsync(CancellationToken ct = default)
    {
        var last = await context.SyncedBlocks
            .OrderByDescending(x => x.BlockNumber)
            .FirstOrDefaultAsync(ct);
        return last?.BlockNumber ?? 0;
    }

    public async Task SaveBlockAsync(SyncedBlock block, CancellationToken ct = default)
    {
        await context.SyncedBlocks.AddAsync(block, ct);
        await context.SaveChangesAsync(ct);
    }

    public async Task SaveEventAsync(SyncedEvent syncedEvent, CancellationToken ct = default)
    {
        await context.SyncedEvents.AddAsync(syncedEvent, ct);
        await context.SaveChangesAsync(ct);
    }

    public async Task<IEnumerable<SyncedEvent>> GetUnpublishedEventsAsync(CancellationToken ct = default) =>
        await context.SyncedEvents
            .Where(x => !x.IsPublished)
            .OrderBy(x => x.BlockNumber)
            .ToListAsync(ct);

    public async Task MarkEventPublishedAsync(Guid eventId, CancellationToken ct = default)
    {
        var e = await context.SyncedEvents.FindAsync([eventId], ct);
        if (e is null) return;
        e.MarkPublished();
        await context.SaveChangesAsync(ct);
    }
}
