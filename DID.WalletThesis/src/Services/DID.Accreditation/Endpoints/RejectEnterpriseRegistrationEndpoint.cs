using System.Security.Claims;
using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class RejectEnterpriseRegistrationRouteRequest
{
    public string RequestId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public class RejectEnterpriseRegistrationEndpoint(EnterpriseRegistrationService service)
    : Endpoint<RejectEnterpriseRegistrationRouteRequest, EnterpriseRegistrationDto>
{
    public override void Configure()
    {
        Post("/api/enterprise-registrations/{requestId}/reject");
        Policies("BusinessRegistry");
    }

    public override async Task HandleAsync(RejectEnterpriseRegistrationRouteRequest req, CancellationToken ct)
    {
        var reviewerDid = User.FindFirstValue(ClaimTypes.NameIdentifier)
                       ?? User.FindFirstValue("sub")
                       ?? "unknown";

        try
        {
            var result = await service.RejectAsync(req.RequestId, req.Reason, reviewerDid, ct);
            await Send.OkAsync(result, ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
        catch (InvalidOperationException ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(400, ct);
        }
    }
}
