using DID.Shared.Application.Interfaces;

namespace DID.Accreditation.Domain.Interfaces;

public interface IAccreditationRepository : IRepository<Accreditation>
{
    Task<Accreditation?> GetByAccreditationIdAsync(string accreditationId, CancellationToken ct = default);
    Task<IEnumerable<Accreditation>> GetByIssuerDIDAsync(string issuerDid, CancellationToken ct = default);
    Task<IEnumerable<Accreditation>> GetBySubjectDIDAsync(string subjectDid, CancellationToken ct = default);
}
