using DID.Shared.Domain;

namespace DID.BlockchainSync.Domain.Entities;

public class SyncedEvent : Entity
{
    public string EventType { get; private set; } = string.Empty;
    public string ContractAddress { get; private set; } = string.Empty;
    public long BlockNumber { get; private set; }
    public string TransactionHash { get; private set; } = string.Empty;
    public string EventData { get; private set; } = string.Empty;
    public bool IsPublished { get; private set; }

    private SyncedEvent() { }

    public static SyncedEvent Create(
        string eventType,
        string contractAddress,
        long blockNumber,
        string transactionHash,
        string eventData) => new()
    {
        EventType = eventType,
        ContractAddress = contractAddress,
        BlockNumber = blockNumber,
        TransactionHash = transactionHash,
        EventData = eventData,
        IsPublished = false
    };

    public void MarkPublished() => IsPublished = true;
}
