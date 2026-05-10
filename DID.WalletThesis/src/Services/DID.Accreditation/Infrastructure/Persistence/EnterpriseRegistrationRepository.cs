using DID.Accreditation.Domain;
using DID.Accreditation.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DID.Accreditation.Infrastructure.Persistence;

public class EnterpriseRegistrationRepository(AccreditationDbContext context)
    : IEnterpriseRegistrationRepository
{
    public async Task<EnterpriseRegistrationRequest?> GetByIdAsync(string requestId, CancellationToken ct)
        => await context.EnterpriseRegistrationRequests
            .FirstOrDefaultAsync(x => x.RequestId == requestId, ct);

    public async Task<IReadOnlyList<EnterpriseRegistrationRequest>> ListByCountryAsync(
        string? countryCode, RegistrationRequestStatus? status, CancellationToken ct)
    {
        var query = context.EnterpriseRegistrationRequests.AsQueryable();

        if (!string.IsNullOrWhiteSpace(countryCode))
            query = query.Where(x => x.CountryCode == countryCode);

        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);

        return await query.OrderByDescending(x => x.SubmittedAt).ToListAsync(ct);
    }

    public async Task AddAsync(EnterpriseRegistrationRequest request, CancellationToken ct)
        => await context.EnterpriseRegistrationRequests.AddAsync(request, ct);

    public Task UpdateAsync(EnterpriseRegistrationRequest request, CancellationToken ct)
    {
        context.EnterpriseRegistrationRequests.Update(request);
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken ct)
        => await context.SaveChangesAsync(ct);
}
