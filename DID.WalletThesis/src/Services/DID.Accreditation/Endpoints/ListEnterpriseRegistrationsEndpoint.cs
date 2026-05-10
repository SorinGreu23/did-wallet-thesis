using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class ListEnterpriseRegistrationsRequest
{
    public string CountryCode { get; set; } = string.Empty;
    public string? Status { get; set; }
}

public class ListEnterpriseRegistrationsEndpoint(EnterpriseRegistrationService service)
    : Endpoint<ListEnterpriseRegistrationsRequest, List<EnterpriseRegistrationDto>>
{
    public override void Configure()
    {
        Get("/api/enterprise-registrations");
        Policies("BusinessRegistry");
    }

    public override async Task HandleAsync(ListEnterpriseRegistrationsRequest req, CancellationToken ct)
    {
        var results = await service.ListAsync(
            string.IsNullOrWhiteSpace(req.CountryCode) ? null : req.CountryCode,
            req.Status, ct);
        await Send.OkAsync([.. results], ct);
    }
}
