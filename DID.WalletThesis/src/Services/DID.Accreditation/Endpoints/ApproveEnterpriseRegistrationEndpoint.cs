using System.Security.Claims;
using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class ApproveEnterpriseRegistrationRouteRequest
{
    public string RequestId { get; set; } = string.Empty;
    public string AccreditationId { get; set; } = string.Empty;
}

public class ApproveEnterpriseRegistrationEndpoint(EnterpriseRegistrationService service)
    : Endpoint<ApproveEnterpriseRegistrationRouteRequest, EnterpriseRegistrationDto>
{
    public override void Configure()
    {
        Post("/api/enterprise-registrations/{requestId}/approve");
        Policies("BusinessRegistry");
    }

    public override async Task HandleAsync(ApproveEnterpriseRegistrationRouteRequest req, CancellationToken ct)
    {
        var reviewerDid = User.FindFirstValue(ClaimTypes.NameIdentifier)
                       ?? User.FindFirstValue("sub")
                       ?? "unknown";

        try
        {
            var result = await service.ApproveAsync(req.RequestId, req.AccreditationId, reviewerDid, ct);
            await Send.OkAsync(result, ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
        catch (InvalidOperationException)
        {
            AddError("The registration request cannot be approved in its current state.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
