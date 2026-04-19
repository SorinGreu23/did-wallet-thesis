using DID.Credential.Domain.Interfaces;
using DID.Shared.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DID.Credential.Infrastructure.Persistence;

public class CredentialRepository(CredentialDbContext context)
    : BaseRepository<Domain.Credential, CredentialDbContext>(context), ICredentialRepository
{
    public async Task<Domain.Credential?> GetByCredentialIdAsync(string credentialId, CancellationToken ct = default)
        => await dbSet.FirstOrDefaultAsync(x => x.CredentialId == credentialId, ct);

    public async Task<IEnumerable<Domain.Credential>> GetByIssuerDIDAsync(string issuerDid, CancellationToken ct = default)
        => await dbSet.Where(x => x.IssuerDID == issuerDid).ToListAsync(ct);

    public async Task<IEnumerable<Domain.Credential>> GetByHolderDIDAsync(string holderDid, CancellationToken ct = default)
        => await dbSet.Where(x => x.HolderDID == holderDid).ToListAsync(ct);
}
