using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class RevokeAccreditationRequest
{
    public string AccreditationId { get; set; } = string.Empty;
    public string RevokedByDID { get; set; } = string.Empty;
}

public class RevokeAccreditationEndpoint(IAccreditationService service)
    : Endpoint<RevokeAccreditationRequest>
{
    public override void Configure()
    {
        Delete("/api/accreditations/{accreditationId}");
        Policies("Ministry");
    }

    public override async Task HandleAsync(RevokeAccreditationRequest req, CancellationToken ct)
    {
        var found = await service.RevokeAsync(req.AccreditationId, req.RevokedByDID, ct);
        if (!found)
            await Send.NotFoundAsync(ct);
        else
            await Send.NoContentAsync(ct);
    }
}
