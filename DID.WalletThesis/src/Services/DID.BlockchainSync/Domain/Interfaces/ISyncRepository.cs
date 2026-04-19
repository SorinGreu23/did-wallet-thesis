using DID.BlockchainSync.Domain.Entities;

namespace DID.BlockchainSync.Domain.Interfaces;

public interface ISyncRepository
{
  Task<long> GetLastSyncedBlockAsync(CancellationToken ct = default);
  Task SaveBlockAsync(SyncedBlock block, CancellationToken ct = default);
  Task SaveEventAsync(SyncedEvent syncedEvent, CancellationToken ct = default);
  Task<IEnumerable<SyncedEvent>> GetUnpublishedEventsAsync(CancellationToken ct = default);
  Task MarkEventPublishedAsync(Guid eventId, CancellationToken ct = default);
}
