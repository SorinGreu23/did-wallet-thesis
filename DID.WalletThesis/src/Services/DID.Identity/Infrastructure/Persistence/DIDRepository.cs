using DID.Identity.Domain;
using DID.Identity.Domain.Interfaces;
using DID.Shared.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DID.Identity.Infrastructure.Persistence;

public class DIDRepository(IdentityDbContext context)
    : BaseRepository<DecentralizedIdentifier, IdentityDbContext>(context), IDIDRepository
{
    public async Task<DecentralizedIdentifier?> GetByDIDAsync(string did, CancellationToken ct = default)
        => await dbSet.Include(x => x.KeyPairs).FirstOrDefaultAsync(x => x.DID == did, ct);
    public async Task<IEnumerable<KeyPair>> GetKeysByDIDAsync(Guid didId, CancellationToken ct = default)
        => await context.KeyPairs.Where(x => x.DIDId == didId).ToListAsync(ct);

    public async Task AddKeyAsync(KeyPair keyPair, CancellationToken ct = default)
        => await context.KeyPairs.AddAsync(keyPair, ct);
}
