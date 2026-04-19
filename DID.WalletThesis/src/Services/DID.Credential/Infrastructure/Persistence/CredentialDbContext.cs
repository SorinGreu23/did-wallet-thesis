using Microsoft.EntityFrameworkCore;

namespace DID.Credential.Infrastructure.Persistence;

public class CredentialDbContext(DbContextOptions<CredentialDbContext> options) : DbContext(options)
{
    public DbSet<Domain.Credential> Credentials { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Domain.Credential>(e =>
        {
            e.ToTable("credentials");
            e.HasKey(x => x.Id);
            e.Property(x => x.CredentialId).IsRequired().HasMaxLength(200);
            e.HasIndex(x => x.CredentialId).IsUnique();
            e.Property(x => x.IssuerDID).IsRequired().HasMaxLength(200);
            e.Property(x => x.HolderDID).IsRequired().HasMaxLength(200);
            e.Property(x => x.CredentialType).IsRequired().HasMaxLength(100);
            e.Property(x => x.IssuerAccreditationId).HasMaxLength(200);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.TransactionHash).HasMaxLength(200);
            e.Property(x => x.RevokedByDID).HasMaxLength(200);
            e.Property(x => x.RevocationReason).HasMaxLength(500);
            e.Property(x => x.SuspendedByDID).HasMaxLength(200);
        });
    }
}
