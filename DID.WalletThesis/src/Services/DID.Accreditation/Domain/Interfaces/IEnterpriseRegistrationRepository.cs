namespace DID.Accreditation.Domain.Interfaces;

public interface IEnterpriseRegistrationRepository
{
    Task<EnterpriseRegistrationRequest?> GetByIdAsync(string requestId, CancellationToken ct);
    Task<IReadOnlyList<EnterpriseRegistrationRequest>> ListByCountryAsync(string? countryCode, RegistrationRequestStatus? status, CancellationToken ct);
    Task AddAsync(EnterpriseRegistrationRequest request, CancellationToken ct);
    Task UpdateAsync(EnterpriseRegistrationRequest request, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
