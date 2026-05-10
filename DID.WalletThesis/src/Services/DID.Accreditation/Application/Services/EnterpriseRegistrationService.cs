using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Domain;
using DID.Accreditation.Domain.Interfaces;
using DID.Contracts.Accreditation;
using MassTransit;

namespace DID.Accreditation.Application.Services;

public class EnterpriseRegistrationService(
    IEnterpriseRegistrationRepository repository,
    IPublishEndpoint publishEndpoint,
    ILogger<EnterpriseRegistrationService> logger)
{
    private static readonly Dictionary<string, string> CountryNameToCode =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Austria"] = "AT", ["Belgium"] = "BE", ["Bulgaria"] = "BG",
            ["Croatia"] = "HR", ["Cyprus"] = "CY", ["Czechia"] = "CZ",
            ["Czech Republic"] = "CZ", ["Denmark"] = "DK", ["Estonia"] = "EE",
            ["Finland"] = "FI", ["France"] = "FR", ["Germany"] = "DE",
            ["Greece"] = "GR", ["Hungary"] = "HU", ["Ireland"] = "IE",
            ["Italy"] = "IT", ["Latvia"] = "LV", ["Lithuania"] = "LT",
            ["Luxembourg"] = "LU", ["Malta"] = "MT", ["Netherlands"] = "NL",
            ["Poland"] = "PL", ["Portugal"] = "PT", ["Romania"] = "RO",
            ["Slovakia"] = "SK", ["Slovenia"] = "SI", ["Spain"] = "ES",
            ["Sweden"] = "SE",
        };

    private static string ResolveCountryCode(string? countryCode, string? countryName)
    {
        if (!string.IsNullOrWhiteSpace(countryCode))
            return countryCode.Trim().ToUpperInvariant();

        if (!string.IsNullOrWhiteSpace(countryName) &&
            CountryNameToCode.TryGetValue(countryName.Trim(), out var code))
            return code;

        throw new ArgumentException(
            $"Cannot resolve country code from '{countryName}'. Provide a valid EU country name or ISO code.");
    }

    public async Task<EnterpriseRegistrationDto> SubmitAsync(
        SubmitEnterpriseRegistrationRequest req, CancellationToken ct)
    {
        var entity = new EnterpriseRegistrationRequest
        {
            WalletAddress = req.WalletAddress,
            LegalName = req.LegalName,
            FiscalCode = req.FiscalCode,
            CountryCode = ResolveCountryCode(req.CountryCode, req.Country),
            City = req.City,
            Address = req.Address,
            Email = req.Email,
            SignedPayload = req.SignedPayload,
            Status = RegistrationRequestStatus.Pending,
            SubmittedAt = DateTime.UtcNow
        };

        await repository.AddAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation(
            "Enterprise registration submitted: {RequestId} from wallet {Wallet}",
            entity.RequestId, entity.WalletAddress);

        return ToDto(entity);
    }

    public async Task<EnterpriseRegistrationDto?> GetByIdAsync(string requestId, CancellationToken ct)
    {
        var entity = await repository.GetByIdAsync(requestId, ct);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<IReadOnlyList<EnterpriseRegistrationDto>> ListAsync(
        string? countryCode, string? statusFilter, CancellationToken ct)
    {
        RegistrationRequestStatus? status = null;
        if (!string.IsNullOrWhiteSpace(statusFilter) &&
            Enum.TryParse<RegistrationRequestStatus>(statusFilter, ignoreCase: true, out var parsed))
        {
            status = parsed;
        }

        var entities = await repository.ListByCountryAsync(countryCode, status, ct);
        return entities.Select(ToDto).ToList();
    }

    public async Task<EnterpriseRegistrationDto> ApproveAsync(
        string requestId, string accreditationId, string reviewerDid, CancellationToken ct)
    {
        var entity = await repository.GetByIdAsync(requestId, ct)
            ?? throw new KeyNotFoundException($"Registration request {requestId} not found");

        if (entity.Status != RegistrationRequestStatus.Pending)
            throw new InvalidOperationException(
                $"Request {requestId} is already in status {entity.Status}");

        entity.Status = RegistrationRequestStatus.Approved;
        entity.AccreditationId = accreditationId;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewedByDid = reviewerDid;
        entity.UpdatedAt = DateTime.UtcNow;

        await repository.UpdateAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        await publishEndpoint.Publish(new EnterpriseRegistrationApprovedEvent(
            RequestId: entity.RequestId,
            WalletAddress: entity.WalletAddress,
            LegalName: entity.LegalName,
            CountryCode: entity.CountryCode,
            AccreditationId: accreditationId,
            ReviewedByDid: reviewerDid,
            ReviewedAt: entity.ReviewedAt.Value), ct);

        logger.LogInformation(
            "Enterprise registration approved: {RequestId} with accreditation {AccreditationId} by {Reviewer}",
            requestId, accreditationId, reviewerDid);

        return ToDto(entity);
    }

    public async Task<EnterpriseRegistrationDto> RejectAsync(
        string requestId, string reason, string reviewerDid, CancellationToken ct)
    {
        var entity = await repository.GetByIdAsync(requestId, ct)
            ?? throw new KeyNotFoundException($"Registration request {requestId} not found");

        if (entity.Status != RegistrationRequestStatus.Pending)
            throw new InvalidOperationException(
                $"Request {requestId} is already in status {entity.Status}");

        entity.Status = RegistrationRequestStatus.Rejected;
        entity.RejectionReason = reason;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.ReviewedByDid = reviewerDid;
        entity.UpdatedAt = DateTime.UtcNow;

        await repository.UpdateAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation(
            "Enterprise registration rejected: {RequestId} by {Reviewer} — {Reason}",
            requestId, reviewerDid, reason);

        return ToDto(entity);
    }

    private static EnterpriseRegistrationDto ToDto(EnterpriseRegistrationRequest e) => new(
        RequestId: e.RequestId,
        WalletAddress: e.WalletAddress,
        LegalName: e.LegalName,
        FiscalCode: e.FiscalCode,
        CountryCode: e.CountryCode,
        City: e.City,
        Address: e.Address,
        Email: e.Email,
        Status: e.Status.ToString(),
        AccreditationId: e.AccreditationId,
        RejectionReason: e.RejectionReason,
        SubmittedAt: e.SubmittedAt,
        ReviewedAt: e.ReviewedAt);
}
