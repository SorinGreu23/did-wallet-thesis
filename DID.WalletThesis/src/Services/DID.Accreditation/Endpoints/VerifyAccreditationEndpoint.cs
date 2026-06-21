using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class VerifyAccreditationRequest
{
    public string AccreditationId { get; set; } = string.Empty;
}

public class VerifyAccreditationEndpoint(IAccreditationService service)
    : Endpoint<VerifyAccreditationRequest, AccreditationVerificationDto>
{
    public override void Configure()
    {
        Get("/api/accreditations/{accreditationId}/verify");
        AllowAnonymous();
    }

    public override async Task HandleAsync(VerifyAccreditationRequest req, CancellationToken ct)
    {
        var result = await service.VerifyAsync(req.AccreditationId, ct);
        var statusCode = result.IsValid ? 200 : 500;
        await Send.OkAsync(result, ct);
    }
}
