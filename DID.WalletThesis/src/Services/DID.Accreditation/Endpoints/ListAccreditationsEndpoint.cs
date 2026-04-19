using System.Security.Claims;
using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class ListAccreditationsRequest
{
    public string? IssuerDid { get; set; }
    public string? SubjectDid { get; set; }
    public string? Scope { get; set; }
}

public class ListAccreditationsEndpoint(AccreditationService service)
    : Endpoint<ListAccreditationsRequest, List<AccreditationDto>>
{
    public override void Configure()
    {
        Get("/api/accreditations");
        Policies("Institution");
    }

    public override async Task HandleAsync(ListAccreditationsRequest req, CancellationToken ct)
    {
        var callerDid = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");
        var callerScope = User.FindFirstValue("scope") ?? "";
        var callerAccreditationId = User.FindFirstValue("accreditation_id");

        var results = await service.ListAsync(req.IssuerDid, req.SubjectDid, req.Scope, ct);

        // EURoot sees everything; others see only their subtree
        if (!callerScope.Equals("EURoot", StringComparison.OrdinalIgnoreCase) && callerDid is not null)
        {
            results = results.Where(a =>
                a.IssuerDID.Equals(callerDid, StringComparison.OrdinalIgnoreCase) ||
                a.SubjectDID.Equals(callerDid, StringComparison.OrdinalIgnoreCase) ||
                (callerAccreditationId is not null &&
                 a.ParentAccreditationId?.Equals(callerAccreditationId, StringComparison.OrdinalIgnoreCase) == true));
        }

        await Send.OkAsync([.. results], ct);
    }
}
