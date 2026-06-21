using System.Text.RegularExpressions;
using DID.Accreditation.Application.DTOs;
using DID.Accreditation.Application.Services;
using FastEndpoints;

namespace DID.Accreditation.Endpoints;

public class SubmitEnterpriseRegistrationEndpoint(EnterpriseRegistrationService service)
    : Endpoint<SubmitEnterpriseRegistrationRequest, EnterpriseRegistrationDto>
{
    private static readonly Regex WalletAddressRegex =
        new(@"^0x[0-9a-fA-F]{40}$", RegexOptions.Compiled);

    public override void Configure()
    {
        Post("/api/enterprise-registrations");
        AllowAnonymous();
    }

    public override async Task HandleAsync(SubmitEnterpriseRegistrationRequest req, CancellationToken ct)
    {
        if (!WalletAddressRegex.IsMatch(req.WalletAddress))
        {
            AddError(r => r.WalletAddress, "Invalid Ethereum wallet address format. Expected 0x followed by 40 hex characters.");
            await Send.ErrorsAsync(400, ct);
            return;
        }

        try
        {
            var result = await service.SubmitAsync(req, ct);
            await Send.CreatedAtAsync<GetEnterpriseRegistrationEndpoint>(
                new { requestId = result.RequestId }, result, cancellation: ct);
        }
        catch (ArgumentException)
        {
            AddError("The registration request contains invalid data. Please check all required fields.");
            await Send.ErrorsAsync(400, ct);
        }
    }
}
