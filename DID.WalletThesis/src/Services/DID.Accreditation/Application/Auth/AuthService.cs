using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DID.Accreditation.Domain;
using DID.Accreditation.Domain.Interfaces;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Nethereum.Signer;
using Nethereum.Web3.Accounts;

namespace DID.Accreditation.Application.Auth;

public partial class AuthService(
    IServiceScopeFactory scopeFactory,
    IBlockchainService blockchain,
    IOptions<AuthOptions> authOptions,
    IOptions<BlockchainOptions> blockchainOptions,
    ILogger<AuthService> logger)
{
    private const string DidPrefix = "did:ethr:sepolia:";

    private static readonly Regex DidPattern = DidPatternRegex();

    private readonly ConcurrentDictionary<string, PendingChallenge> _challenges = new();
    private readonly string _euRootAddress = NormalizeAddress(new Account(blockchainOptions.Value.PrivateKey).Address);

    public ChallengeResponse CreateChallenge(string did)
    {
        if (!DidPattern.IsMatch(did))
            throw new ArgumentException(
                "Invalid DID format. Expected: did:ethr:sepolia:0x followed by 40 hex characters", nameof(did));

        var nonce = GenerateNonce();
        var expiresAt = DateTime.UtcNow.AddMinutes(authOptions.Value.ChallengeExpiryMinutes);

        _challenges[nonce] = new PendingChallenge(nonce, did.ToLowerInvariant(), expiresAt);

        logger.LogInformation("Created auth challenge for DID {Did}, expires at {ExpiresAt}", did, expiresAt);
        return new ChallengeResponse(nonce, expiresAt);
    }

    public async Task<VerifyResponse> VerifyChallengeAsync(string did, string nonce, string signature)
    {
        var normalizedDid = did.ToLowerInvariant();

        if (!_challenges.TryRemove(nonce, out var challenge))
            throw new UnauthorizedAccessException("Invalid or already-used nonce");

        if (challenge.ExpiresAt < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Challenge has expired");

        if (challenge.Did != normalizedDid)
            throw new UnauthorizedAccessException("DID does not match the challenge");

        // Recover the Ethereum address from the signature
        var signer = new EthereumMessageSigner();
        string recoveredAddress;
        try
        {
            recoveredAddress = NormalizeAddress(signer.EncodeUTF8AndEcRecover(nonce, signature));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Signature recovery failed for DID {Did}", did);
            throw new UnauthorizedAccessException("Invalid signature");
        }

        // Verify recovered address matches the DID address component
        var didAddress = ExtractAddress(normalizedDid);
        if (!string.Equals(recoveredAddress, didAddress, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException(
                "Recovered address does not match DID. The signature was not created by the DID's private key.");

        // Determine the caller's scope from blockchain state
        var (scope, accreditationId) = await DetermineScopeAsync(didAddress);

        if (scope is null)
            throw new ForbiddenAccessException("DID has no on-chain accreditation and is not the EU Root authority");

        var token = GenerateJwt(normalizedDid, didAddress, scope, accreditationId);
        var expiresAt = DateTime.UtcNow.AddMinutes(authOptions.Value.TokenExpiryMinutes);

        logger.LogInformation("Authenticated DID {Did} with scope {Scope}", did, scope);
        return new VerifyResponse(token, scope, accreditationId, expiresAt);
    }

    private async Task<(string? Scope, string? AccreditationId)> DetermineScopeAsync(string address)
    {
        // Check if this is the EU Root deployer
        if (string.Equals(address, _euRootAddress, StringComparison.OrdinalIgnoreCase))
            return ("EURoot", null);

        // First try the local DB (fast path)
        var subjectDid = $"{DidPrefix}{address}";

        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IAccreditationRepository>();
        var accreditations = await repository.GetBySubjectDIDAsync(subjectDid);

        var bestAccreditation = accreditations
            .Where(a => a.Status == AccreditationStatus.Active)
            .OrderBy(a => ScopeRank(a.Scope))
            .FirstOrDefault();

        if (bestAccreditation is not null)
            return (bestAccreditation.Scope, bestAccreditation.AccreditationId);

        // Fallback: query the blockchain directly (handles bootstrapped / externally-issued accreditations)
        logger.LogInformation("No DB accreditation for {Address}, falling back to blockchain", address);
        return await DetermineScopeFromBlockchainAsync(address);
    }

    private async Task<(string? Scope, string? AccreditationId)> DetermineScopeFromBlockchainAsync(string address)
    {
        try
        {
            // Check if the address is a member state via EURootAuthority.isMemberState()
            var isMemberState = await blockchain.CallContractAsync<bool>(
                "EURootAuthority", "isMemberState", address);
            if (isMemberState)
                return ("MemberState", null);

            // Check accreditations on AccreditationRegistry
            var accreditationIds = await blockchain.CallContractAsync<List<byte[]>>(
                "AccreditationRegistry", "getAccreditationsBySubject", address);

            if (accreditationIds is null || accreditationIds.Count == 0)
                return (null, null);

            // Check each accreditation to find the highest-scope active one
            foreach (var idBytes in accreditationIds)
            {
                var accreditation = await blockchain.CallContractAsync<AccreditationOutput>(
                    "AccreditationRegistry", "getAccreditation", idBytes);

                if (accreditation is null || accreditation.Revoked || !accreditation.Exists)
                    continue;

                var scopeName = accreditation.Scope switch
                {
                    1 => "MemberState",
                    2 => "Ministry",
                    3 => "Institution",
                    4 => "Department",
                    _ => null
                };

                if (scopeName is not null)
                {
                    var hexId = "0x" + Convert.ToHexString(idBytes).ToLowerInvariant();
                    return (scopeName, hexId);
                }
            }

            return (null, null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Blockchain fallback failed for {Address}", address);
            return (null, null);
        }
    }

    private static int ScopeRank(string scope) => scope switch
    {
        "MemberState" => 1,
        "Ministry" => 2,
        "Institution" => 3,
        "Department" => 4,
        _ => 99
    };

    private string GenerateJwt(string did, string ethAddress, string scope, string? accreditationId)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(authOptions.Value.JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, did),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("eth_address", ethAddress),
            new("scope", scope),
        };

        if (accreditationId is not null)
            claims.Add(new Claim("accreditation_id", accreditationId));

        var token = new JwtSecurityToken(
            expires: DateTime.UtcNow.AddMinutes(authOptions.Value.TokenExpiryMinutes),
            claims: claims,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateNonce()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string ExtractAddress(string didOrAddress)
    {
        var candidate = didOrAddress.Trim();
        if (candidate.StartsWith(DidPrefix, StringComparison.OrdinalIgnoreCase))
            candidate = candidate[DidPrefix.Length..];
        return NormalizeAddress(candidate);
    }

    private static string NormalizeAddress(string address)
    {
        if (!address.StartsWith("0x", StringComparison.OrdinalIgnoreCase) || address.Length != 42)
            throw new ArgumentException($"Invalid Ethereum address: {address}", nameof(address));
        return address.ToLowerInvariant();
    }

    [GeneratedRegex(@"^did:ethr:sepolia:0x[0-9a-fA-F]{40}$")]
    private static partial Regex DidPatternRegex();

    private sealed record PendingChallenge(string Nonce, string Did, DateTime ExpiresAt);
}

public class ForbiddenAccessException(string message) : Exception(message);

/// <summary>Maps the Solidity Accreditation struct from AccreditationRegistry.getAccreditation()</summary>
[Nethereum.ABI.FunctionEncoding.Attributes.FunctionOutput]
public class AccreditationOutput
{
    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("bytes32", "id", 1)]
    public byte[] Id { get; set; } = [];

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("address", "issuer", 2)]
    public string Issuer { get; set; } = string.Empty;

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("address", "subject", 3)]
    public string Subject { get; set; } = string.Empty;

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("bytes32", "parentAccreditationId", 4)]
    public byte[] ParentAccreditationId { get; set; } = [];

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("uint8", "scope", 5)]
    public int Scope { get; set; }

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("bytes32", "permissionsHash", 6)]
    public byte[] PermissionsHash { get; set; } = [];

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("uint256", "issuedAt", 7)]
    public System.Numerics.BigInteger IssuedAt { get; set; }

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("uint256", "expiresAt", 8)]
    public System.Numerics.BigInteger ExpiresAt { get; set; }

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("bool", "revoked", 9)]
    public bool Revoked { get; set; }

    [Nethereum.ABI.FunctionEncoding.Attributes.Parameter("bool", "exists", 10)]
    public bool Exists { get; set; }
}
