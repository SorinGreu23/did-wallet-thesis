using DID.Identity.Application.DTOs;
using DID.Identity.Domain;
using DID.Identity.Domain.Interfaces;
using DID.Identity.Infrastructure.Cryptography;
using Microsoft.EntityFrameworkCore;
using Nethereum.Signer;

namespace DID.Identity.Application.Services;

public class DIDService(
    IDIDRepository repository,
    IKeyGenerator keyGen,
    ILogger<DIDService> logger)
{
    private const int OwnershipProofWindowMinutes = 5;

    public async Task<DIDDocumentDto> CreateDIDAsync(string controllerAddress, CancellationToken ct = default)
    {
        var did = $"did:ethr:sepolia:{controllerAddress}";
        var keyPair = keyGen.GenerateSecp256k1KeyPair();

        var didEntity = new DecentralizedIdentifier
        {
            DID = did,
            ControllerAddress = controllerAddress
        };

        didEntity.KeyPairs.Add(new KeyPair
        {
            DIDId = didEntity.Id,
            KeyType = "EcdsaSecp256k1VerificationKey2019",
            PublicKey = keyPair.PublicKey,
            EncryptedPrivateKey = keyPair.EncryptedPrivateKey,
            Purpose = "authentication,assertionMethod"
        });

        try
        {
            await repository.AddAsync(didEntity, ct);
            await repository.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Unique constraint on DID column prevents concurrent duplicate creation.
            throw new InvalidOperationException($"DID already exists for address {controllerAddress}");
        }

        logger.LogInformation("Created DID {DID} for controller {Address}", did, controllerAddress);

        return BuildDocument(didEntity);
    }

    public async Task<DIDDocumentDto> ResolveDIDAsync(string did, CancellationToken ct = default)
    {
        var entity = await repository.GetByDIDAsync(did, ct)
            ?? throw new KeyNotFoundException($"DID {did} not found");

        return BuildDocument(entity);
    }

    public async Task<IEnumerable<PublicKeyDto>> GetPublicKeysAsync(string did, CancellationToken ct = default)
    {
        var entity = await repository.GetByDIDAsync(did, ct)
            ?? throw new KeyNotFoundException($"DID {did} not found");

        return entity.KeyPairs.Select((k, i) => new PublicKeyDto(
            Id: $"{did}#keys-{i + 1}",
            Type: k.KeyType,
            Controller: did,
            PublicKey: k.PublicKey,
            Purpose: k.Purpose
        ));
    }

    public async Task<RegisteredIdentityDto> RegisterExternalAsync(
        string did, string controllerAddress, string? displayName, string? email,
        string? accountType,
        long timestamp, string? signature,
        CancellationToken ct = default)
    {
        if (signature is not null)
            VerifyOwnershipProof(controllerAddress, timestamp, signature);

        var existing = await repository.GetByDIDAsync(did, ct);
        if (existing is not null)
        {
            existing.DisplayName = displayName;
            existing.Email = email;
            existing.AccountType = NormalizeAccountType(accountType);
            await repository.UpdateAsync(existing, ct);
            await repository.SaveChangesAsync(ct);
            logger.LogInformation("Updated registration for DID {DID}", did);
            return ToRegisteredDto(existing);
        }

        var entity = new DecentralizedIdentifier
        {
            DID = did,
            ControllerAddress = controllerAddress,
            DisplayName = displayName,
            Email = email,
            AccountType = NormalizeAccountType(accountType)
        };

        try
        {
            await repository.AddAsync(entity, ct);
            await repository.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Lost the insert race — fetch the row the winning request created and update it.
            var winner = await repository.GetByDIDAsync(did, ct)
                ?? throw new InvalidOperationException($"Concurrent registration failed for DID {did}");
            winner.DisplayName = displayName;
            winner.Email = email;
            winner.AccountType = NormalizeAccountType(accountType);
            await repository.UpdateAsync(winner, ct);
            await repository.SaveChangesAsync(ct);
            logger.LogInformation("Resolved concurrent registration for DID {DID}", did);
            return ToRegisteredDto(winner);
        }

        logger.LogInformation("Registered external DID {DID} for {Name}", did, displayName);
        return ToRegisteredDto(entity);
    }

    public async Task<IEnumerable<RegisteredIdentityDto>> ListRegisteredAsync(
        string? accountType = null,
        CancellationToken ct = default)
    {
        var all = await repository.GetAllAsync(ct);
        var normalizedAccountType = NormalizeAccountType(accountType);
        if (normalizedAccountType is not null)
        {
            all = all.Where(x =>
                string.Equals(x.AccountType, normalizedAccountType, StringComparison.OrdinalIgnoreCase));
        }

        return all.Select(ToRegisteredDto);
    }

    // ── Ownership proof ───────────────────────────────────────────────────────

    private static void VerifyOwnershipProof(string controllerAddress, long timestamp, string signature)
    {
        var signedAt = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime;
        var age = (DateTime.UtcNow - signedAt).TotalSeconds;
        if (age < -30 || age > OwnershipProofWindowMinutes * 60)
            throw new ArgumentException("Ownership proof timestamp is expired or invalid");

        var message = $"{controllerAddress.ToLowerInvariant()}:{timestamp}";
        string recoveredAddress;
        try
        {
            recoveredAddress = new EthereumMessageSigner()
                .EncodeUTF8AndEcRecover(message, signature)
                .ToLowerInvariant();
        }
        catch
        {
            throw new ArgumentException("Ownership proof signature is invalid");
        }

        if (!string.Equals(recoveredAddress, controllerAddress.ToLowerInvariant(), StringComparison.Ordinal))
            throw new ArgumentException("Signature does not prove ownership of the controller address");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static RegisteredIdentityDto ToRegisteredDto(DecentralizedIdentifier entity)
        => new(
            entity.DID,
            entity.ControllerAddress,
            entity.DisplayName,
            entity.Email,
            entity.AccountType,
            entity.CreatedAt);

    private static string? NormalizeAccountType(string? accountType)
    {
        if (string.IsNullOrWhiteSpace(accountType))
            return null;

        return accountType.Trim().ToLowerInvariant() switch
        {
            "personal" => "personal",
            "university" => "university",
            "enterprise" => "enterprise",
            _ => throw new ArgumentException($"Unsupported account type: {accountType}")
        };
    }

    private static DIDDocumentDto BuildDocument(DecentralizedIdentifier entity)
    {
        var key = entity.KeyPairs.First();
        var keyId = $"{entity.DID}#keys-1";

        return new DIDDocumentDto(
            Id: entity.DID,
            Controller: entity.DID,
            VerificationMethod: [new(keyId, key.KeyType, entity.DID, key.PublicKey)],
            Authentication: [keyId],
            AssertionMethod: [keyId],
            Created: entity.CreatedAt
        );
    }
}
