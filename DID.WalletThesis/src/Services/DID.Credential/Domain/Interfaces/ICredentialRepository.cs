using DID.Shared.Application.Interfaces;

namespace DID.Credential.Domain.Interfaces;

public interface ICredentialRepository : IRepository<Credential>
{
    Task<Credential?> GetByCredentialIdAsync(string credentialId, CancellationToken ct = default);
    Task<IEnumerable<Credential>> GetByIssuerDIDAsync(string issuerDid, CancellationToken ct = default);
    Task<IEnumerable<Credential>> GetByHolderDIDAsync(string holderDid, CancellationToken ct = default);
}
