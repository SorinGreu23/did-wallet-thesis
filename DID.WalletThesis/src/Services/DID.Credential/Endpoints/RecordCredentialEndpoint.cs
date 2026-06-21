using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

/// <summary>
/// Records a credential whose on-chain transaction was signed and submitted
/// entirely by the caller's browser wallet. The private key never reaches the server.
/// </summary>
public class RecordCredentialEndpoint(ICredentialService service)
    : Endpoint<RecordCredentialRequest, CredentialDto>
{
    public override void Configure()
    {
        Post("/api/credentials/record");
        AllowAnonymous();
    }

    public override async Task HandleAsync(RecordCredentialRequest req, CancellationToken ct)
    {
        try
        {
            var result = await service.RecordFromClientTxAsync(
                req.TxHash,
                req.IssuerDID,
                req.HolderDID,
                req.CredentialType,
                req.CredentialHash,
                req.IssuerAccreditationId,
                req.IssuerName,
                ct);

            await Send.OkAsync(result, cancellation: ct);
        }
        catch (KeyNotFoundException)
        {
            await Send.NotFoundAsync(ct);
        }
        catch (InvalidOperationException)
        {
            AddError("The credential could not be recorded. Please verify the transaction hash is valid and the on-chain data matches.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
