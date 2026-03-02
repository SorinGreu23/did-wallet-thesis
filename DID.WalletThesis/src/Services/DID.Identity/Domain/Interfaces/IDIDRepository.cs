using System;
using DID.Shared.Application.Interfaces;

namespace DID.Identity.Domain.Interfaces;

public interface IDIDRepository : IRepository<DecentralizedIdentifier>
{
  Task<DecentralizedIdentifier?> GetByDIDAsync(string did, CancellationToken ct = default);
  Task<IEnumerable<KeyPair>> GetKeysByDIDAsync(Guid didId, CancellationToken ct = default);
}
