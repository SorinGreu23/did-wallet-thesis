using DID.Identity.Domain;
using Microsoft.EntityFrameworkCore;

namespace DID.Identity.Infrastructure.Persistence;

public class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<DecentralizedIdentifier> DIDs { get; set; }
    public DbSet<KeyPair> KeyPairs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DecentralizedIdentifier>(e =>
        {
            e.ToTable("dids");
            e.HasKey(x => x.Id);
            e.Property(x => x.DID).IsRequired().HasMaxLength(200);
            e.HasIndex(x => x.DID).IsUnique();
            e.Property(x => x.ControllerAddress).IsRequired().HasMaxLength(42);
            e.HasMany(x => x.KeyPairs)
                .WithOne(x => x.DecentralizedIdentifier)
                .HasForeignKey(x => x.DIDId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<KeyPair>(e =>
        {
            e.ToTable("key_pairs");
            e.HasKey(x => x.Id);
            e.Property(x => x.KeyType).IsRequired().HasMaxLength(50);
            e.Property(x => x.PublicKey).IsRequired();
            e.Property(x => x.EncryptedPrivateKey).IsRequired();
            e.Property(x => x.Purpose).IsRequired().HasMaxLength(100);
        });
    }
}
