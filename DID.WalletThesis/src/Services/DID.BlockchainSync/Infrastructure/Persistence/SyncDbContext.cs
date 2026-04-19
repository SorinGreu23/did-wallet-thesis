using DID.BlockchainSync.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DID.BlockchainSync.Infrastructure.Persistence;

public class SyncDbContext(DbContextOptions<SyncDbContext> options) : DbContext(options)
{
    public DbSet<SyncedBlock> SyncedBlocks => Set<SyncedBlock>();
    public DbSet<SyncedEvent> SyncedEvents => Set<SyncedEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SyncedBlock>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.BlockNumber).IsUnique();
            b.Property(x => x.BlockHash).IsRequired().HasMaxLength(66);
        });

        modelBuilder.Entity<SyncedEvent>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.TransactionHash);
            b.Property(x => x.EventType).IsRequired().HasMaxLength(100);
            b.Property(x => x.ContractAddress).IsRequired().HasMaxLength(42);
            b.Property(x => x.EventData).HasColumnType("jsonb");
        });
    }
}
