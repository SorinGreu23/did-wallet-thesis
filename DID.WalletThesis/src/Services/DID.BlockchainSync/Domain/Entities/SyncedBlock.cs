using DID.Shared.Domain;

namespace DID.BlockchainSync.Domain.Entities;

public class SyncedBlock : Entity
{
    public long BlockNumber { get; private set; }
    public string BlockHash { get; private set; } = string.Empty;
    public DateTime BlockTimestamp { get; private set; }
    public bool IsProcessed { get; private set; }

    private SyncedBlock() {}

    public static SyncedBlock Create(long blockNumber, string blockHash, DateTime blockTimestamp) => new()
    {
        BlockNumber = blockNumber,
        BlockHash = blockHash,
        BlockTimestamp = blockTimestamp,
        IsProcessed = false
    };

    public void MarkProcessed() => IsProcessed = true;
}
