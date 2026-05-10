using DID.Accreditation.Domain;
using Microsoft.EntityFrameworkCore;

namespace DID.Accreditation.Infrastructure.Persistence;

public class AccreditationDbContext(DbContextOptions<AccreditationDbContext> options) : DbContext(options)
{
    public DbSet<Domain.Accreditation> Accreditations { get; set; }
    public DbSet<EnterpriseRegistrationRequest> EnterpriseRegistrationRequests { get; set; }

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

        modelBuilder.Entity<EnterpriseRegistrationRequest>(e =>
        {
            e.ToTable("enterprise_registration_requests");
            e.HasKey(x => x.Id);
            e.Property(x => x.RequestId).IsRequired().HasMaxLength(100);
            e.HasIndex(x => x.RequestId).IsUnique();
            e.Property(x => x.WalletAddress).IsRequired().HasMaxLength(200);
            e.Property(x => x.LegalName).IsRequired().HasMaxLength(500);
            e.Property(x => x.FiscalCode).IsRequired().HasMaxLength(100);
            e.Property(x => x.CountryCode).IsRequired().HasMaxLength(10);
            e.Property(x => x.City).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.Email).HasMaxLength(300);
            e.Property(x => x.SignedPayload).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.AccreditationId).HasMaxLength(200);
            e.Property(x => x.RejectionReason).HasMaxLength(1000);
            e.Property(x => x.ReviewedByDid).HasMaxLength(200);
        });
    }
}
