using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class ListAccreditationsRequest
{
    public string? IssuerDid { get; set; }
    public string? SubjectDid { get; set; }
}

public class ListAccreditationsEndpoint(AccreditationService service)
    : Endpoint<ListAccreditationsRequest, List<AccreditationDto>>
{
    public override void Configure()
    {
        Get("/api/accreditations");
        AllowAnonymous();
    }

    public override async Task HandleAsync(ListAccreditationsRequest req, CancellationToken ct)
    {
        var results = await service.ListAsync(req.IssuerDid, req.SubjectDid, ct);
        await Send.OkAsync(results.ToList(), ct);
    }
}
