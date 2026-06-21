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

        if (entity.KeyPairs.Count == 0)
        {
            var addedKey = EnsureExternalPublicKey(entity, null, null);
            if (addedKey is not null)
            {
                await repository.AddKeyAsync(addedKey, ct);
                await repository.SaveChangesAsync(ct);
            }
        }

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
        string? publicKeyHex, string? keyType,
        CancellationToken ct = default)
    {
        if (signature is not null)
            VerifyOwnershipProof(controllerAddress, timestamp, signature);

        var existing = await repository.GetByDIDAsync(did, ct);
        if (existing is not null)
        {
            var addedKey = EnsureExternalPublicKey(existing, publicKeyHex, keyType);
            if (addedKey is not null)
                await repository.AddKeyAsync(addedKey, ct);
            existing.DisplayName = displayName;
            existing.Email = email;
            existing.AccountType = NormalizeAccountType(accountType);
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
        EnsureExternalPublicKey(entity, publicKeyHex, keyType);

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
            var addedKey = EnsureExternalPublicKey(winner, publicKeyHex, keyType);
            if (addedKey is not null)
                await repository.AddKeyAsync(addedKey, ct);
            winner.DisplayName = displayName;
            winner.Email = email;
            winner.AccountType = NormalizeAccountType(accountType);
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

    private static KeyPair? EnsureExternalPublicKey(
        DecentralizedIdentifier entity,
        string? publicKeyHex,
        string? keyType)
    {
        var candidate = publicKeyHex ?? TryExtractPublicKeyFromDid(entity.DID);
        if (candidate is null)
            return null;

        var normalizedPublicKey = NormalizePublicKey(candidate);
        var derivedAddress = new EthECKey(
                Convert.FromHexString(normalizedPublicKey[2..]),
                isPrivate: false)
            .GetPublicAddress();

        if (!string.Equals(
                derivedAddress,
                entity.ControllerAddress,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                "The submitted public key does not belong to the controller address.");
        }

        var existingKey = entity.KeyPairs.FirstOrDefault();
        if (existingKey is not null)
        {
            var existingAddress = new EthECKey(
                    Convert.FromHexString(NormalizePublicKey(existingKey.PublicKey)[2..]),
                    isPrivate: false)
                .GetPublicAddress();

            if (!string.Equals(
                    existingAddress,
                    derivedAddress,
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException(
                    "The submitted public key does not match the registered key.");
            }

            return null;
        }

        var keyPair = new KeyPair
        {
            DIDId = entity.Id,
            KeyType = NormalizeKeyType(keyType),
            PublicKey = normalizedPublicKey,
            // External wallet private keys never leave the device.
            EncryptedPrivateKey = string.Empty,
            Purpose = "authentication,assertionMethod"
        };
        entity.KeyPairs.Add(keyPair);
        return keyPair;
    }

    private static string? TryExtractPublicKeyFromDid(string did)
    {
        var identifier = did.Split(':').LastOrDefault();
        if (string.IsNullOrWhiteSpace(identifier))
            return null;

        var hex = identifier.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? identifier[2..]
            : identifier;
        return hex.Length is 66 or 130 ? identifier : null;
    }

    private static string NormalizePublicKey(string publicKeyHex)
    {
        var value = publicKeyHex.Trim();
        var hex = value.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? value[2..]
            : value;

        if (hex.Length is not (66 or 130))
            throw new ArgumentException("The public key must be compressed or uncompressed secp256k1.");

        try
        {
            _ = Convert.FromHexString(hex);
        }
        catch (FormatException)
        {
            throw new ArgumentException("The public key must be hexadecimal.");
        }

        return $"0x{hex.ToLowerInvariant()}";
    }

    private static string NormalizeKeyType(string? keyType)
        => keyType?.Trim() switch
        {
            "EcdsaSecp256k1VerificationKey2019" =>
                "EcdsaSecp256k1VerificationKey2019",
            "Secp256k1" => "EcdsaSecp256k1VerificationKey2019",
            null or "" => "EcdsaSecp256k1VerificationKey2019",
            _ => throw new ArgumentException($"Unsupported key type: {keyType}")
        };

    private static DIDDocumentDto BuildDocument(DecentralizedIdentifier entity)
    {
        var key = entity.KeyPairs.FirstOrDefault();
        if (key is null)
        {
            var controllerKeyId = $"{entity.DID}#controller";
            return new DIDDocumentDto(
                Id: entity.DID,
                Controller: entity.DID,
                VerificationMethod:
                [
                    new(
                        controllerKeyId,
                        "EcdsaSecp256k1RecoveryMethod2020",
                        entity.DID,
                        entity.ControllerAddress)
                ],
                Authentication: [controllerKeyId],
                AssertionMethod: [controllerKeyId],
                Created: entity.CreatedAt
            );
        }

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
