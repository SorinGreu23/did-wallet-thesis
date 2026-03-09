using Microsoft.EntityFrameworkCore;

namespace DID.Accreditation.Infrastructure.Persistence;

public class AccreditationDbContext(DbContextOptions<AccreditationDbContext> options) : DbContext(options)
{
    public DbSet<Domain.Accreditation> Accreditations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Domain.Accreditation>(e =>
        {
            e.ToTable("accreditations");
            e.HasKey(x => x.Id);
            e.Property(x => x.AccreditationId).IsRequired().HasMaxLength(200);
            e.HasIndex(x => x.AccreditationId).IsUnique();
            e.Property(x => x.IssuerDID).IsRequired().HasMaxLength(200);
            e.Property(x => x.SubjectDID).IsRequired().HasMaxLength(200);
            e.Property(x => x.ParentAccreditationId).HasMaxLength(200);
            e.Property(x => x.Scope).IsRequired().HasMaxLength(50);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.TransactionHash).HasMaxLength(200);
            e.Property(x => x.RevokedByDID).HasMaxLength(200);
        });
    }
}
