using DID.Contracts.Identity;
using DID.Identity.Application.DTOs;
using DID.Identity.Domain;
using DID.Identity.Domain.Interfaces;
using DID.Identity.Infrastructure.Cryptography;
using DID.Shared.Application.Interfaces;

namespace DID.Identity.Application.Services;

public class DIDService(
    IDIDRepository repository,
    IKeyGenerator keyGen,
    IEventBus eventBus,
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

        await eventBus.PublishAsync(new DIDCreatedEvent(
            DID: did,
            ControllerAddress: controllerAddress,
            PublicKey: keyPair.PublicKey,
            CreatedAt: didEntity.CreatedAt
        ), ct);

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
