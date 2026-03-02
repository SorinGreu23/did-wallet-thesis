using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class IssueAccreditationEndpoint(AccreditationService service)
    : Endpoint<IssueAccreditationRequest, AccreditationDto>
{
    public override void Configure()
    {
        Post("/api/accreditations");
        AllowAnonymous();
    }

    public override async Task HandleAsync(IssueAccreditationRequest req, CancellationToken ct)
    {
        var result = await service.IssueAsync(req.IssuerDID, req.SubjectDID, req.Scope, req.ParentAccreditationId, ct);
        await Send.CreatedAtAsync<ResolveAccreditationEndpoint>(
            new { accreditationId = result.AccreditationId }, result, cancellation: ct);
    }
}
