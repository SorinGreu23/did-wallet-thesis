using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class RecordRevocationRequest
{
    public string AccreditationId { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public string RevokedByDID { get; set; } = string.Empty;
}

/// <summary>
/// Records a revocation whose on-chain transaction was signed and submitted
/// entirely by the caller's browser wallet (member state or ministry).
/// The private key never reaches the server.
/// </summary>
public class RecordRevocationEndpoint(AccreditationService service)
    : Endpoint<RecordRevocationRequest>
{
    public override void Configure()
    {
        Post("/api/accreditations/{accreditationId}/record-revoke");
        Policies("Ministry");
    }

    public override async Task HandleAsync(RecordRevocationRequest req, CancellationToken ct)
    {
        try
        {
            var found = await service.RevokeFromClientTxAsync(req.TxHash, req.AccreditationId, req.RevokedByDID, ct);
            if (!found)
                await Send.NotFoundAsync(ct);
            else
                await Send.NoContentAsync(ct);
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
