using DID.Identity.Application.DTOs;
using DID.Identity.Domain;
using DID.Identity.Domain.Interfaces;
using DID.Identity.Infrastructure.Cryptography;

namespace DID.Identity.Application.Services;

public class DIDService(
    IDIDRepository repository,
    IKeyGenerator keyGen,
    ILogger<DIDService> logger)
{
    public async Task<DIDDocumentDto> CreateDIDAsync(string controllerAddress, CancellationToken ct = default)
    {
        var did = $"did:ethr:sepolia:{controllerAddress}";

        if (await repository.GetByDIDAsync(did, ct) is not null)
            throw new InvalidOperationException($"DID already exists for address {controllerAddress}");

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

        await repository.AddAsync(didEntity, ct);
        await repository.SaveChangesAsync(ct);

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
        CancellationToken ct = default)
    {
        var existing = await repository.GetByDIDAsync(did, ct);
        if (existing is not null)
        {
            existing.DisplayName = displayName;
            existing.Email = email;
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
            Email = email
        };

        await repository.AddAsync(entity, ct);
        await repository.SaveChangesAsync(ct);

        logger.LogInformation("Registered external DID {DID} for {Name}", did, displayName);
        return ToRegisteredDto(entity);
    }

    public async Task<IEnumerable<RegisteredIdentityDto>> ListRegisteredAsync(CancellationToken ct = default)
    {
        var all = await repository.GetAllAsync(ct);
        return all.Select(ToRegisteredDto);
    }

    private static RegisteredIdentityDto ToRegisteredDto(DecentralizedIdentifier entity)
        => new(entity.DID, entity.ControllerAddress, entity.DisplayName, entity.Email, entity.CreatedAt);

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
