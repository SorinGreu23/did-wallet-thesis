using DID.Credential.Application.Services;
using FastEndpoints;

namespace DID.Credential.Endpoints;

public class RecordCredentialRevocationRequest
{
    public string CredentialId { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public string RevokedByDID { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Records a credential revocation whose on-chain transaction was signed and submitted
/// entirely by the caller's browser wallet (e.g. a university). The private key never reaches the server.
/// </summary>
public class RecordCredentialRevocationEndpoint(ICredentialService service)
    : Endpoint<RecordCredentialRevocationRequest>
{
    public override void Configure()
    {
        Post("/api/credentials/{credentialId}/record-revoke");
        Policies("Institution");
    }

    public override async Task HandleAsync(RecordCredentialRevocationRequest req, CancellationToken ct)
    {
        try
        {
            var found = await service.RecordRevokedFromClientTxAsync(
                req.TxHash, req.CredentialId, req.RevokedByDID, req.Reason, ct);

            if (!found)
                await Send.NotFoundAsync(ct);
            else
                await Send.NoContentAsync(ct);
        }
        catch (InvalidOperationException)
        {
            AddError("The revocation could not be recorded. Please verify the transaction hash and credential status.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
