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
        Policies("Ministry");
    }

    public override async Task HandleAsync(IssueAccreditationRequest req, CancellationToken ct)
    {
        try
        {
            var result = await service.IssueAsync(
                req.IssuerDID,
                req.SubjectDID,
                req.Scope,
                req.Name,
                req.ParentAccreditationId,
                req.PermissionsHash,
                req.ExpiresAt,
                ct);
            await Send.CreatedAtAsync<ResolveAccreditationEndpoint>(
                new { accreditationId = result.AccreditationId }, result, cancellation: ct);
        }
        catch (ArgumentOutOfRangeException ex) when (ex.ParamName == "scope")
        {
            AddError(r => r.Scope, ex.Message);
            await Send.ErrorsAsync(400, ct);
        }
        catch (ArgumentException ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(400, ct);
        }
        catch (InvalidOperationException ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(400, ct);
        }
        catch (Exception ex)
        {
            AddError(ex.Message);
            await Send.ErrorsAsync(400, ct);
        }
    }
}
