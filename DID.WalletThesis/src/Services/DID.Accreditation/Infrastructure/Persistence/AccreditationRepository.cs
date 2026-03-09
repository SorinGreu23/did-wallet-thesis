using DID.Accreditation.Domain.Interfaces;
using DID.Shared.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DID.Accreditation.Infrastructure.Persistence;

public class AccreditationRepository(AccreditationDbContext context)
    : BaseRepository<Domain.Accreditation, AccreditationDbContext>(context), IAccreditationRepository
{
    public async Task<Domain.Accreditation?> GetByAccreditationIdAsync(string accreditationId, CancellationToken ct = default)
        => await dbSet.FirstOrDefaultAsync(x => x.AccreditationId == accreditationId, ct);

    public async Task<IEnumerable<Domain.Accreditation>> GetByIssuerDIDAsync(string issuerDid, CancellationToken ct = default)
        => await dbSet.Where(x => EF.Functions.ILike(x.IssuerDID, issuerDid)).ToListAsync(ct);

    public async Task<IEnumerable<Domain.Accreditation>> GetByIssuerDIDAndScopeAsync(string issuerDid, string scope, CancellationToken ct = default)
        => await dbSet.Where(x => EF.Functions.ILike(x.IssuerDID, issuerDid) && EF.Functions.ILike(x.Scope, scope)).ToListAsync(ct);

    public async Task<IEnumerable<Domain.Accreditation>> GetBySubjectDIDAsync(string subjectDid, CancellationToken ct = default)
        => await dbSet.Where(x => EF.Functions.ILike(x.SubjectDID, subjectDid)).ToListAsync(ct);
}
