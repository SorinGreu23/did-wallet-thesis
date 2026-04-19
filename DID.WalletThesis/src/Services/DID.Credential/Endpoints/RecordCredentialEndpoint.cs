using DID.Credential.Application.DTOs;
using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

/// <summary>
/// Records a credential whose on-chain transaction was signed and submitted
/// entirely by the caller's browser wallet. The private key never reaches the server.
/// </summary>
public class RecordCredentialEndpoint(CredentialService service)
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

            await Send.CreatedAtAsync<ResolveCredentialEndpoint>(
                new { credentialId = result.CredentialId }, result, cancellation: ct);
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
