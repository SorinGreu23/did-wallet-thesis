using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class GetEnterpriseRegistrationRequest
{
    public string RequestId { get; set; } = string.Empty;
}

public class GetEnterpriseRegistrationEndpoint(EnterpriseRegistrationService service)
    : Endpoint<GetEnterpriseRegistrationRequest, EnterpriseRegistrationDto>
{
    public override void Configure()
    {
        Get("/api/enterprise-registrations/{requestId}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(GetEnterpriseRegistrationRequest req, CancellationToken ct)
    {
        var result = await service.GetByIdAsync(req.RequestId, ct);
        if (result is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(result, ct);
    }
}
