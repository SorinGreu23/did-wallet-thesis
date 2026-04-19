using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

/// <summary>
/// Records an accreditation whose on-chain transaction was signed and submitted
/// entirely by the caller's browser wallet. The private key never reaches the server.
/// </summary>
public class RecordAccreditationEndpoint(AccreditationService service)
    : Endpoint<RecordAccreditationRequest, AccreditationDto>
{
    public override void Configure()
    {
        Post("/api/accreditations/record");
        Policies("Ministry");
    }

    public override async Task HandleAsync(RecordAccreditationRequest req, CancellationToken ct)
    {
        try
        {
            var result = await service.RecordFromClientTxAsync(
                req.TxHash,
                req.IssuerDID,
                req.SubjectDID,
                req.Scope,
                req.Name,
                req.ParentAccreditationId,
                ct);

            await Send.CreatedAtAsync<ResolveAccreditationEndpoint>(
                new { accreditationId = result.AccreditationId }, result, cancellation: ct);
        }
        catch (KeyNotFoundException ex)
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
