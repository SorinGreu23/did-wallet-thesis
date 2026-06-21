using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class IssueAccreditationEndpoint(IAccreditationService service)
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
        catch (ArgumentOutOfRangeException)
        {
            AddError(r => r.Scope, "The specified accreditation scope is not valid.");
            await Send.ErrorsAsync(400, ct);
        }
        catch (ArgumentException)
        {
            AddError("The accreditation request contains invalid parameters.");
            await Send.ErrorsAsync(400, ct);
        }
        catch (InvalidOperationException)
        {
            AddError("The accreditation could not be issued. Please verify the parent accreditation is active and you have the required authority.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
