using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class ResolveAccreditationRequest
{
    public string AccreditationId { get; set; } = string.Empty;
}

public class ResolveAccreditationEndpoint(AccreditationService service)
    : Endpoint<ResolveAccreditationRequest, AccreditationDto>
{
    public override void Configure()
    {
        Get("/api/accreditations/{accreditationId}");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ResolveAccreditationRequest req, CancellationToken ct)
    {
        try
        {
            await Send.OkAsync(await service.ResolveAsync(req.AccreditationId, ct), ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
    }
}
