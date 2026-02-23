# Development Plan: 9 Microservices for DID Wallet Thesis

## Executive Summary

**Project:** Bachelor's thesis - EU Decentralized Digital Identity System with hierarchical trust chains

**Current State:**
- ✅ Mobile wallet (React Native/Expo) fully implemented with DID and credential management
- ✅ Smart contracts implemented, compiled, tested, deployed (Hardhat via Docker, chainId 31337)
- ✅ Docker Compose infrastructure (PostgreSQL 16, RabbitMQ 3.12, Hardhat node)
- ✅ DID.Contracts — RabbitMQ event DTOs for all services
- ✅ DID.Shared.Domain / Application / Infrastructure — shared base classes + Nethereum/MassTransit/EF Core implementations
- ✅ All 9 .NET microservice projects scaffolded in solution
- ✅ BlockchainSync Service — fully implemented (event listener → PostgreSQL + RabbitMQ)
- ✅ ZKP Service (Node.js) implemented — circuits compiled, keys generated
- ⏳ Identity Service — next priority
- ⏳ Remaining 7 microservices

**Core Architectural Principle:**
> **Blockchain is the source of truth — NOT microservices.**
>
> Smart contracts always validate authorization on-chain. Microservices are convenience wrappers only (off-chain storage, event listeners, UI helpers). Microservices NEVER make authorization decisions, validate trust chains, or act as gatekeepers.

**9 Microservices — Implementation Status:**
1. ⏳ Identity Service - DID document generation, key pair storage
2. ⏳ Accreditation Service - UI wrapper for AccreditationRegistry.sol
3. ⏳ Credential Service - W3C VC generation, calls CredentialRegistry.sol
4. ⏳ Verification Service - Orchestrates 5-step verification reading from blockchain
5. ✅ Blockchain Sync Service - Event listener, mirrors blockchain to PostgreSQL, publishes to RabbitMQ
6. ⏳ Presentation Service - QR codes, SignalR for holder-verifier communication
7. ✅ ZKP Service (Node.js) - Zero-knowledge proof generation/verification
8. ⏳ Notification Service - Email (SendGrid), push (FCM)
9. ⏳ Audit Service - Event sourcing, immutable audit logs

**Timeline:** 14 weeks across 6 phases

---

## Table of Contents

1. [Trust Hierarchy](#trust-hierarchy)
2. [Development Philosophy](#development-philosophy)
3. [Phase 0: Foundation & Prerequisites](#phase-0-foundation--prerequisites)
4. [Phase 1: Core Infrastructure Services](#phase-1-core-infrastructure-services)
5. [Phase 2: Accreditation & Credential Services](#phase-2-accreditation--credential-services)
6. [Phase 3: Verification Services](#phase-3-verification-services)
7. [Phase 4: Presentation & Communication](#phase-4-presentation--communication)
8. [Phase 5: Support Services](#phase-5-support-services)
9. [Phase 6: Integration & Testing](#phase-6-integration--testing)
10. [Critical Implementation Patterns](#critical-implementation-patterns)
11. [Configuration Strategy](#configuration-strategy)
12. [Testing Strategy](#testing-strategy)
13. [Success Criteria](#success-criteria)

---

## Trust Hierarchy

Every arrow is enforced by smart contract logic:

```
EU Root Authority (EURootAuthority.sol - multi-sig governance, 66% approval)
  → Member State (AccreditationRegistry.sol - checks isMemberState())
    → Ministry (AccreditationRegistry.sol - validates parent chain)
      → Institution (AccreditationRegistry.sol - validates parent chain)
        → Credential (CredentialRegistry.sol - validates issuer accreditation)
```

### Three-Layer Trust Anchor

Solves the bootstrapping problem:

1. **Institutional Trust:** europa.eu publishes DID configuration with contract addresses (GPG-signed)
2. **Cryptographic Trust:** Deployment ceremony with 18+ EU member state witness signatures stored on-chain
3. **Bidirectional Verification:** Website publishes contract address, contract stores `did:web:europa.eu`

---

## Development Philosophy

### Blockchain-First Pattern

**ALWAYS:**
```csharp
var isAuthorized = await _blockchain.CallContractAsync<bool>(
    "AccreditationRegistry",
    "hasValidAccreditation",
    issuerAddress,
    scope
);
```

**NEVER:**
```csharp
var issuer = await _repository.GetAsync(issuerDID);
var isAuthorized = issuer.IsAuthorized; // ❌ CENTRALIZED!
```

### Clean Architecture

Each .NET service has its own `Domain/ → Application/ → Infrastructure/ → Workers or Controllers/` layers. Shared infrastructure (Nethereum, MassTransit, EF Core base classes) lives in `DID.Shared.*` projects to avoid duplication.

**Shared projects:**
- `DID.Contracts` — RabbitMQ event DTOs (records only, no logic)
- `DID.Shared.Domain` — `Entity`, `ValueObject`, `AggregateRoot` base classes
- `DID.Shared.Application` — `IBlockchainService`, `IEventBus`, `IRepository<T>` interfaces
- `DID.Shared.Infrastructure` — `BlockchainService` (Nethereum), `RabbitMQEventBus`, `BaseRepository<T,TContext>`

```
DID.WalletThesis/src/
├── Contracts/
│   └── DID.Contracts/              ← event DTOs (records)
├── Shared/
│   ├── DID.Shared.Domain/          ← base entities/value objects
│   ├── DID.Shared.Application/     ← interfaces
│   └── DID.Shared.Infrastructure/  ← Nethereum, MassTransit, EF Core impls
└── Services/
    ├── DID.BlockchainSync/     ← ✅ implemented
    ├── DID.Identity/           ← ⏳ next
    ├── DID.Accreditation/      ← ⏳
    ├── DID.Credential/         ← ⏳
    ├── DID.Verification/       ← ⏳
    ├── DID.Presentation/       ← ⏳
    ├── DID.Notification/       ← ⏳
    └── DID.Audit/              ← ⏳
```

### Event-Driven Architecture

RabbitMQ + MassTransit for asynchronous communication. Blockchain Sync Service is the single source of blockchain state updates.

---

## PHASE 0: Foundation & Prerequisites (Week 1-2)

**Status:** ✅ Complete

### 0.1 Smart Contracts ✅ COMPLETED

**Directory Structure:**
```
blockchain/
├── contracts/
│   ├── EURootAuthority.sol       ✅ Implemented
│   ├── AccreditationRegistry.sol ✅ Implemented
│   └── CredentialRegistry.sol    ✅ Implemented
├── scripts/
│   └── deploy.ts                 ✅ Implemented
├── test/
│   ├── EURootAuthority.test.ts   ✅ Implemented
│   ├── AccreditationRegistry.test.ts ✅ Implemented
│   └── CredentialRegistry.test.ts    ✅ Implemented
├── abis/ (will be generated on compile)
├── hardhat.config.ts             ✅ Implemented
└── package.json                  ✅ Implemented
```

**Key Functions Implemented:**

**EURootAuthority.sol:**
- `isMemberState(address)` - Source of truth for EU membership
- `verifyDeploymentCeremony()` - Validates witness signatures
- `bootstrapMemberStates()` - One-time initialization
- Multi-sig governance with 66% approval threshold

**AccreditationRegistry.sol:**
- `issueAccreditation()` - Validates parent chain before issuing
- `validateTrustChain(bytes32)` - Walks chain up to root
- `hasValidAccreditation(address, scope)` - Authorization check
- `getTrustChain(bytes32)` - Reconstruct full chain

**CredentialRegistry.sol:**
- `recordCredential()` - Validates issuer has institution-level accreditation
- `isActive(bytes32)` - Check credential status
- `revokeCredential()` - Mark credential as revoked
- `verifyCredential()` - Complete verification (status + trust chain)
- `batchVerifyCredentials()` - Batch verification

**Completed:**
- ✅ `npm install` run, all tests passing
- ✅ Deployed to local Hardhat network — addresses in `blockchain/deployments/latest.json`
- ✅ ABIs exported to `blockchain/abis/`
- ✅ TypeScript bindings (typechain-types) generated

---

### 0.2 Shared Contracts Project ✅ COMPLETED

**Architecture decision:** No shared Domain/Infrastructure libraries. Each service is fully self-contained. The only shared project is a thin contracts library for RabbitMQ message DTOs.

**Location:** `DID.WalletThesis/src/Contracts/DID.Contracts/`

```
DID.Contracts/
├── Identity/
│   └── DIDCreatedEvent.cs
├── Accreditation/
│   ├── AccreditationIssuedEvent.cs
│   └── AccreditationRevokedEvent.cs
├── Credential/
│   ├── CredentialIssuedEvent.cs
│   ├── CredentialRevokedEvent.cs
│   └── CredentialSuspendedEvent.cs
└── Verification/
    └── VerificationCompletedEvent.cs
```

**Per-service NuGet packages (added to each service individually):**
- Nethereum.Web3
- MassTransit
- MassTransit.RabbitMQ
- Npgsql.EntityFrameworkCore.PostgreSQL
- Serilog.AspNetCore

**IBlockchainService pattern (defined and implemented within each service):**
```csharp
public interface IBlockchainService
{
    Task<T> CallContractAsync<T>(string contractName, string functionName, params object[] args);
    Task<string> SubmitTransactionAsync(TransactionData transaction);
    Task<TransactionReceipt> WaitForConfirmationAsync(string txHash, CancellationToken ct = default);
    Task SubscribeToEventAsync<TEventDTO>(string contractName, string eventName,
        Func<TEventDTO, Task> handler) where TEventDTO : class, new();
}
```

---

### 0.3 Docker Compose Infrastructure ✅ COMPLETED

**Location:** `docker-compose.yml` in project root

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: did-postgres
    environment:
      POSTGRES_USER: did_admin
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: did_platform
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U did_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  rabbitmq:
    image: rabbitmq:3.12-management
    container_name: did-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: did_admin
      RABBITMQ_DEFAULT_PASS: dev_password
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  hardhat:
    build: ./blockchain
    container_name: did-hardhat
    ports:
      - "8545:8545"
    command: npx hardhat node
    volumes:
      - ./blockchain:/app

volumes:
  postgres_data:
  rabbitmq_data:
```

**Verification Commands:**
```bash
docker-compose up -d
docker-compose ps  # All services healthy
curl http://localhost:15672  # RabbitMQ management (guest:guest)
psql -h localhost -U did_admin -d did_platform  # PostgreSQL
curl -X POST http://localhost:8545 -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'  # Hardhat
```

---

## PHASE 1: Core Infrastructure Services (Week 3-4)

### 1.1 Blockchain Sync Service (HIGHEST PRIORITY)

**Why first?** All other services depend on blockchain state being synced to PostgreSQL for fast queries.

**Location:** `DID.WalletThesis/src/Services/DID.BlockchainSync/`

**Structure:**
```
DID.BlockchainSync/
├── Domain/
│   ├── Entities/
│   │   ├── SyncedBlock.cs
│   │   ├── SyncedTransaction.cs
│   │   └── SyncedEvent.cs
│   └── Interfaces/
│       └── ISyncRepository.cs
│
├── Application/
│   ├── Services/
│   │   ├── BlockchainSyncService.cs
│   │   └── EventProcessingService.cs
│   └── Handlers/
│       ├── AccreditationEventHandler.cs
│       └── CredentialEventHandler.cs
│
├── Infrastructure/
│   ├── Persistence/
│   │   ├── SyncDbContext.cs
│   │   └── SyncRepository.cs
│   └── Blockchain/
│       └── EventListener.cs
│
└── API/
    ├── Workers/
    │   └── BlockchainSyncWorker.cs  # Background service
    ├── Controllers/
    │   └── SyncController.cs
    └── Program.cs
```

**Database Schema:**
```sql
CREATE TABLE synced_blocks (
    block_number BIGINT PRIMARY KEY,
    block_hash VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE synced_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (block_number) REFERENCES synced_blocks(block_number)
);

CREATE INDEX idx_events_type ON synced_events(event_type);
CREATE INDEX idx_events_block ON synced_events(block_number);
CREATE INDEX idx_events_processed ON synced_events(processed);
```

**Implementation Pattern:**
```csharp
public class BlockchainSyncWorker : BackgroundService
{
    private readonly IBlockchainService _blockchain;
    private readonly IPublishEndpoint _publisher;
    private readonly ISyncRepository _syncRepo;
    private readonly ILogger<BlockchainSyncWorker> _logger;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("Starting blockchain sync worker...");

        // Subscribe to AccreditationIssued events
        await _blockchain.SubscribeToEventAsync<AccreditationIssuedEventDTO>(
            "AccreditationRegistry",
            "AccreditationIssued",
            async (eventData) =>
            {
                _logger.LogInformation("Received AccreditationIssued event: {Id}", eventData.Id);

                // Store in database
                await _syncRepo.SaveEventAsync(new SyncedEvent
                {
                    EventType = "AccreditationIssued",
                    ContractAddress = eventData.ContractAddress,
                    BlockNumber = eventData.BlockNumber,
                    TransactionHash = eventData.TransactionHash,
                    EventData = JsonSerializer.Serialize(eventData)
                });

                // Publish to RabbitMQ
                await _publisher.Publish(new AccreditationIssuedEvent
                {
                    AccreditationId = eventData.Id,
                    IssuerDID = eventData.Issuer,
                    SubjectDID = eventData.Subject,
                    Scope = eventData.Scope,
                    BlockNumber = eventData.BlockNumber,
                    TransactionHash = eventData.TransactionHash,
                    Timestamp = DateTime.UtcNow
                }, ct);
            }
        );

        // Subscribe to CredentialIssued events
        await _blockchain.SubscribeToEventAsync<CredentialIssuedEventDTO>(
            "CredentialRegistry",
            "CredentialIssued",
            async (eventData) =>
            {
                await _syncRepo.SaveEventAsync(/*...*/);
                await _publisher.Publish(new CredentialIssuedEvent { /*...*/ }, ct);
            }
        );

        // Keep worker alive
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(1000, ct);
        }
    }
}
```

**Events to Subscribe:**
- `AccreditationIssued` → Publish to `accreditation-events`
- `AccreditationRevoked` → Publish to `accreditation-events`
- `CredentialIssued` → Publish to `credential-events`
- `CredentialRevoked` → Publish to `credential-events`
- `CredentialSuspended` → Publish to `credential-events`

**API Endpoints:**
- `GET /api/sync/status` - Get sync status (current block, events synced)
- `GET /api/sync/health` - Health check

---

### 1.2 Identity Service

**Location:** `DID.WalletThesis/src/Services/DID.Identity/`

**Structure:**
```
DID.Identity/
├── Domain/
│   ├── Entities/
│   │   ├── DecentralizedIdentifier.cs
│   │   └── KeyPair.cs
│   ├── ValueObjects/
│   │   ├── DIDDocument.cs
│   │   └── PublicKey.cs
│   └── Interfaces/
│       └── IDIDRepository.cs
│
├── Application/
│   ├── Commands/
│   │   └── CreateDIDCommand.cs
│   ├── Queries/
│   │   ├── ResolveDIDQuery.cs
│   │   └── GetDIDDocumentQuery.cs
│   └── Services/
│       └── DIDService.cs
│
├── Infrastructure/
│   ├── Persistence/
│   │   ├── IdentityDbContext.cs
│   │   └── DIDRepository.cs
│   └── Cryptography/
│       └── KeyGenerator.cs
│
└── API/
    ├── Controllers/
    │   └── DIDController.cs
    └── Program.cs
```

**Database Schema:**
```sql
CREATE TABLE dids (
    id UUID PRIMARY KEY,
    did VARCHAR(200) UNIQUE NOT NULL,
    controller_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE key_pairs (
    id UUID PRIMARY KEY,
    did_id UUID NOT NULL,
    key_type VARCHAR(50) NOT NULL,  -- Ed25519, secp256k1
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    purpose VARCHAR(50) NOT NULL,    -- authentication, assertionMethod
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (did_id) REFERENCES dids(id) ON DELETE CASCADE
);

CREATE TABLE did_documents (
    id UUID PRIMARY KEY,
    did_id UUID UNIQUE NOT NULL,
    document JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (did_id) REFERENCES dids(id)
);
```

**API Endpoints:**
- `POST /api/dids` - Create new DID (did:ethr:sepolia:0x...)
- `GET /api/dids/{did}` - Resolve DID document
- `GET /api/dids/{did}/keys` - Get public keys
- `POST /api/dids/{did}/rotate-keys` - Rotate key pairs

**IMPORTANT:** This service does NOT authorize who can create DIDs. Anyone can create a DID. Authorization happens at accreditation level via smart contracts.

**DIDService Implementation:**
```csharp
public class DIDService
{
    private readonly IDIDRepository _repository;
    private readonly IKeyGenerator _keyGen;

    public async Task<DIDDocument> CreateDIDAsync(string controllerAddress)
    {
        // Generate DID: did:ethr:sepolia:{address}
        var did = $"did:ethr:sepolia:{controllerAddress}";

        // Generate key pair
        var keyPair = await _keyGen.GenerateEd25519KeyPairAsync();

        // Create DID entity
        var didEntity = new DecentralizedIdentifier
        {
            DID = did,
            ControllerAddress = controllerAddress,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(didEntity);

        // Create DID document
        var didDocument = new DIDDocument
        {
            Id = did,
            Controller = did,
            VerificationMethod = new[]
            {
                new VerificationMethod
                {
                    Id = $"{did}#keys-1",
                    Type = "Ed25519VerificationKey2020",
                    Controller = did,
                    PublicKeyMultibase = keyPair.PublicKey
                }
            },
            Authentication = new[] { $"{did}#keys-1" },
            AssertionMethod = new[] { $"{did}#keys-1" }
        };

        return didDocument;
    }
}
```

---

## PHASE 2: Accreditation & Credential Services (Week 5-7)

### 2.1 Accreditation Service

**CRITICAL PRINCIPLE:** This is a UI wrapper for AccreditationRegistry.sol. It does NOT make authorization decisions - the smart contract does.

**Location:** `DID.WalletThesis/src/Services/DID.Accreditation/`

**Database Schema:**
```sql
CREATE TABLE accreditations (
    id UUID PRIMARY KEY,
    accreditation_id VARCHAR(100) UNIQUE NOT NULL,
    issuer_did VARCHAR(200) NOT NULL,
    subject_did VARCHAR(200) NOT NULL,
    parent_id VARCHAR(100),
    scope VARCHAR(50) NOT NULL,  -- MemberState, Ministry, Institution
    permissions_hash VARCHAR(66) NOT NULL,
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accred_subject ON accreditations(subject_did);
CREATE INDEX idx_accred_parent ON accreditations(parent_id);
CREATE INDEX idx_accred_scope ON accreditations(scope);
```

**Blockchain-First Implementation:**
```csharp
public class AccreditationService
{
    private readonly IBlockchainService _blockchain;
    private readonly IAccreditationRepository _repository;

    public async Task<AccreditationDto> IssueAccreditationAsync(IssueAccreditationCommand cmd)
    {
        var transaction = new TransactionData
        {
            ContractName = "AccreditationRegistry",
            FunctionName = "issueAccreditation",
            Parameters = new object[]
            {
                cmd.SubjectAddress,
                (int)cmd.Scope,
                cmd.ParentAccreditationId,
                cmd.PermissionsHash,
                cmd.ExpiresAt
            }
        };

        // Submit to blockchain - BLOCKCHAIN validates authority
        var txHash = await _blockchain.SubmitTransactionAsync(transaction);
        var receipt = await _blockchain.WaitForConfirmationAsync(txHash);

        // Cache will be updated by Blockchain Sync Service via events
        // Return result immediately
        return new AccreditationDto
        {
            TransactionHash = txHash,
            BlockNumber = receipt.BlockNumber
        };
    }

    public async Task<TrustChainResult> ValidateTrustChainAsync(string accredId)
    {
        // Call blockchain validation - SOURCE OF TRUTH
        var isValid = await _blockchain.CallContractAsync<bool>(
            "AccreditationRegistry",
            "validateTrustChain",
            HashToBytes32(accredId)
        );

        // Optionally reconstruct chain from blockchain for visualization
        var chainIds = await _blockchain.CallContractAsync<byte[][]>(
            "AccreditationRegistry",
            "getTrustChain",
            HashToBytes32(accredId)
        );

        var chain = new List<AccreditationDto>();
        foreach (var id in chainIds)
        {
            var accred = await _blockchain.CallContractAsync<AccreditationStruct>(
                "AccreditationRegistry",
                "getAccreditation",
                id
            );
            chain.Add(MapToDto(accred));
        }

        return new TrustChainResult
        {
            IsValid = isValid,
            Chain = chain
        };
    }
}
```

**Event Consumption:**
```csharp
public class AccreditationEventConsumer : IConsumer<AccreditationIssuedEvent>
{
    private readonly IAccreditationRepository _repository;

    public async Task Consume(ConsumeContext<AccreditationIssuedEvent> context)
    {
        var evt = context.Message;

        // Update local cache
        var accreditation = new Accreditation
        {
            AccreditationId = evt.AccreditationId,
            IssuerDID = evt.IssuerDID,
            SubjectDID = evt.SubjectDID,
            Scope = evt.Scope,
            IssuedAt = evt.Timestamp,
            BlockNumber = evt.BlockNumber,
            TransactionHash = evt.TransactionHash
        };

        await _repository.AddAsync(accreditation);
    }
}
```

---

### 2.2 Credential Service

**Location:** `DID.WalletThesis/src/Services/DID.Credential/`

**Database Schema:**
```sql
CREATE TABLE credentials (
    id UUID PRIMARY KEY,
    credential_id VARCHAR(100) UNIQUE NOT NULL,
    issuer_did VARCHAR(200) NOT NULL,
    holder_did VARCHAR(200) NOT NULL,
    credential_type VARCHAR(100) NOT NULL,
    encrypted_credential BYTEA NOT NULL,  -- Full W3C VC encrypted
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cred_issuer ON credentials(issuer_did);
CREATE INDEX idx_cred_holder ON credentials(holder_did);
CREATE INDEX idx_cred_type ON credentials(credential_type);
```

**Implementation:**
```csharp
public class CredentialIssuanceService
{
    private readonly IVeramoIntegrationService _veramo;
    private readonly IBlockchainService _blockchain;
    private readonly ICredentialRepository _repository;

    public async Task<VerifiableCredential> IssueCredentialAsync(IssueCredentialCommand cmd)
    {
        // 1. Generate W3C VC using Veramo
        var vc = await _veramo.CreateCredentialAsync(new CreateCredentialRequest
        {
            Issuer = cmd.IssuerDID,
            Holder = cmd.HolderDID,
            CredentialSubject = cmd.CredentialSubject,
            Type = new[] { "VerifiableCredential", cmd.CredentialType },
            ExpirationDate = cmd.ExpiresAt
        });

        // 2. Hash credential for blockchain ID
        var credentialHash = HashCredential(vc);

        // 3. Call CredentialRegistry.recordCredential()
        // Smart contract validates issuer accreditation
        var transaction = new TransactionData
        {
            ContractName = "CredentialRegistry",
            FunctionName = "recordCredential",
            Parameters = new object[]
            {
                cmd.HolderAddress,
                credentialHash,
                cmd.CredentialType,
                cmd.IssuerAccreditationId,
                cmd.ExpiresAt?.ToUnixTimeSeconds() ?? 0
            }
        };

        var txHash = await _blockchain.SubmitTransactionAsync(transaction);
        await _blockchain.WaitForConfirmationAsync(txHash);

        // 4. Encrypt and store full credential off-chain
        var encryptedVC = await EncryptCredentialAsync(vc, cmd.HolderPublicKey);

        await _repository.AddAsync(new Credential
        {
            CredentialId = vc.Id,
            IssuerDID = cmd.IssuerDID,
            HolderDID = cmd.HolderDID,
            CredentialType = cmd.CredentialType,
            EncryptedCredential = encryptedVC,
            TransactionHash = txHash
        });

        return vc;
    }
}
```

---

## PHASE 3: Verification Services (Week 8-9)

### 3.1 Verification Service

**5-Step Verification Process:**

```csharp
public class VerificationOrchestrator
{
    private readonly IBlockchainService _blockchain;
    private readonly IHttpClientFactory _httpFactory;

    public async Task<VerificationResult> VerifyPresentationAsync(
        VerifiablePresentation presentation)
    {
        var result = new VerificationResult();

        // Step 1: Verify cryptographic signature (local)
        result.SignatureValid = await VerifySignatureAsync(presentation);

        foreach (var credential in presentation.VerifiableCredentials)
        {
            var credentialId = HashCredential(credential);

            // Step 2: Check credential status ON BLOCKCHAIN
            var (isActive, status, _) = await _blockchain.CallContractAsync<
                (bool, CredentialStatus, bool)>(
                "CredentialRegistry",
                "verifyCredential",
                credentialId
            );
            result.CredentialActive = isActive;

            // Step 3: Get issuer's accreditations FROM BLOCKCHAIN
            var issuerAccreditations = await _blockchain.CallContractAsync<byte[][]>(
                "AccreditationRegistry",
                "getAccreditationsBySubject",
                credential.Issuer
            );

            // Step 4: Validate trust chain ON BLOCKCHAIN
            var trustChainValid = false;
            foreach (var accredId in issuerAccreditations)
            {
                trustChainValid = await _blockchain.CallContractAsync<bool>(
                    "AccreditationRegistry",
                    "validateTrustChain",
                    accredId
                );
                if (trustChainValid) break;
            }
            result.TrustChainValid = trustChainValid;

            // Step 5: Verify ZKP if present (call ZKP Service)
            if (credential.Proof.Type == "ZeroKnowledgeProof")
            {
                var zkpClient = _httpFactory.CreateClient("ZKPService");
                var zkpResult = await zkpClient.PostAsJsonAsync("/zkp/verify",
                    credential.Proof);
                result.ZKPValid = zkpResult.IsSuccessStatusCode;
            }
        }

        result.OverallValid = result.SignatureValid &&
                             result.CredentialActive &&
                             result.TrustChainValid &&
                             (result.ZKPValid ?? true);

        return result;
    }
}
```

---

### 3.2 ZKP Service (Node.js) ✅ COMPLETED

**Location:** `zkp-service/` (project root)

**Structure:**
```
zkp-service/
├── src/
│   ├── circuits/
│   │   ├── ageVerification.circom       ✅ private: birthYear | public: currentYear, threshold
│   │   └── graduationYearRange.circom   ✅ private: graduationYear | public: minYear, maxYear
│   ├── controllers/
│   │   └── zkpController.ts             ✅
│   ├── services/
│   │   ├── proofGenerator.ts            ✅ snarkjs.groth16.fullProve
│   │   └── proofVerifier.ts             ✅ snarkjs.groth16.verify
│   ├── types/
│   │   └── zkp.types.ts                 ✅
│   └── index.ts                         ✅
├── circuits_compiled/                   ✅ .wasm files committed
├── keys/                                ✅ _final.zkey + verification_key.json committed
├── scripts/
│   ├── setup-circuits.mjs               ✅ cross-platform (Windows/macOS/Linux)
│   └── setup-circuits.ps1               ✅ Windows fallback
├── package.json
├── tsconfig.json
└── Dockerfile
```

**ZKP privacy model:**
- ZKP protects **attribute-level data** (birth date, graduation year) — not the credential as a whole
- The credential hash and issuer-holder relationship remain on-chain for auditability
- Trust chain traversal is done via blockchain reads (not ZKP)

**Age Verification Circuit:**
```circom
pragma circom 2.0.0;

template AgeVerification() {
    signal input birthYear;
    signal input currentYear;
    signal input threshold;
    signal output valid;

    signal age;
    age <== currentYear - birthYear;

    component greaterThan = GreaterThan(8);
    greaterThan.in[0] <== age;
    greaterThan.in[1] <== threshold;

    valid <== greaterThan.out;
}

component main = AgeVerification();
```

**API Implementation:**
```typescript
import express from 'express';
import { groth16 } from 'snarkjs';

const app = express();
app.use(express.json());

app.post('/zkp/generate/age', async (req, res) => {
    const { birthYear, currentYear, threshold } = req.body;

    const input = {
        birthYear,
        currentYear,
        threshold
    };

    const { proof, publicSignals } = await groth16.fullProve(
        input,
        'circuits_compiled/ageVerification.wasm',
        'keys/ageVerification_final.zkey'
    );

    res.json({ proof, publicSignals });
});

app.post('/zkp/verify', async (req, res) => {
    const { proof, publicSignals } = req.body;

    const vKey = JSON.parse(
        fs.readFileSync('keys/verification_key.json', 'utf-8')
    );

    const isValid = await groth16.verify(vKey, publicSignals, proof);

    res.json({ valid: isValid });
});

app.listen(3000, () => {
    console.log('ZKP Service running on port 3000');
});
```

---

## PHASE 4: Presentation & Communication (Week 10-11)

### 4.1 Presentation Service

**SignalR Hub Implementation:**
```csharp
public class PresentationHub : Hub
{
    private readonly IPresentationService _presentationService;

    public async Task CreatePresentationRequest(PresentationRequestDto request)
    {
        // Generate QR code
        var token = GenerateSecureToken();
        var qrData = new
        {
            RequestToken = token,
            VerifierDID = request.VerifierDID,
            CallbackUrl = $"https://api.example.com/presentations/{token}"
        };

        var qrCode = GenerateQRCode(qrData);

        // Store request
        await _presentationService.CreateRequestAsync(request, token);

        // Send QR to verifier
        await Clients.Caller.SendAsync("PresentationRequestCreated", new
        {
            Token = token,
            QRCode = qrCode,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        });
    }

    public async Task SubmitPresentation(string token, VerifiablePresentation presentation)
    {
        // Find verifier connection
        var request = await _presentationService.GetRequestAsync(token);

        // Notify verifier
        await Clients.User(request.VerifierDID).SendAsync(
            "PresentationReceived",
            presentation
        );
    }
}
```

---

## PHASE 5: Support Services (Week 12-13)

### 5.1 Notification Service

**Event-Driven Only (No Database):**
```csharp
public class CredentialIssuedEventConsumer : IConsumer<CredentialIssuedEvent>
{
    private readonly IEmailService _email;
    private readonly IPushNotificationService _push;

    public async Task Consume(ConsumeContext<CredentialIssuedEvent> context)
    {
        var evt = context.Message;

        // Send email
        await _email.SendAsync(new EmailMessage
        {
            To = evt.HolderEmail,
            Subject = "New Credential Issued",
            Body = $"You have received a new {evt.CredentialType} credential."
        });

        // Send push notification
        await _push.SendAsync(new PushNotification
        {
            UserId = evt.HolderDID,
            Title = "New Credential",
            Body = $"Your {evt.CredentialType} is now available."
        });
    }
}
```

---

### 5.2 Audit Service

**Immutable Event Store:**
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_source VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    actor_did VARCHAR(200),
    target_did VARCHAR(200),
    timestamp TIMESTAMP NOT NULL,
    block_number BIGINT,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);

-- NO UPDATE OR DELETE - immutable logs
-- Partitioned by month for performance
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_did);
CREATE INDEX idx_audit_target ON audit_logs(target_did);
```

---

## PHASE 6: Integration & Testing (Week 14)

### End-to-End Test Scenarios

**Scenario 1: Complete Diploma Issuance**
```csharp
[Fact]
public async Task CompleteIssuanceFlow_ShouldPropagateEvents()
{
    // 1. EU Root accredits Romania
    var romaniaTx = await _rootAuthority.ProposeAddMemberStateAsync("RO", "did:web:gov.ro");
    await VoteAndExecuteProposal(romaniaTx);

    // 2. Romania accredits Ministry of Education
    var ministryTx = await _accreditationRegistry.IssueAccreditationAsync(
        ministryAddress,
        AccreditationScope.Ministry,
        parentId: null
    );

    // 3. Ministry accredits University of Bucharest
    var universityTx = await _accreditationRegistry.IssueAccreditationAsync(
        universityAddress,
        AccreditationScope.Institution,
        ministryAccreditationId
    );

    // 4. University issues diploma
    var credentialTx = await _credentialService.IssueCredentialAsync(new
    {
        IssuerDID = "did:ethr:sepolia:university",
        HolderDID = "did:ethr:sepolia:student",
        CredentialType = "UniversityDegree",
        IssuerAccreditationId = universityAccreditationId
    });

    // 5. Verify events propagated
    await Task.Delay(3000); // Allow event processing

    var events = await _auditService.GetEventsAsync();
    Assert.Contains(events, e => e.EventType == "AccreditationIssued");
    Assert.Contains(events, e => e.EventType == "CredentialIssued");
}
```

**Scenario 2: Cross-Border Verification**
```csharp
[Fact]
public async Task CrossBorderVerification_ShouldValidateTrustChain()
{
    // German employer creates presentation request
    var request = await _presentationService.CreateRequestAsync(new
    {
        VerifierDID = "did:ethr:sepolia:german-employer",
        RequestedCredentials = new[] { "UniversityDegree" },
        ZKPRequirements = new { MinAge = 21 }
    });

    // Romanian student submits presentation with ZKP
    var presentation = CreatePresentation(romanianDiploma, ageProof);
    await _presentationService.SubmitPresentationAsync(request.Token, presentation);

    // Verification validates trust chain from blockchain
    var result = await _verificationService.VerifyPresentationAsync(presentation);

    Assert.True(result.OverallValid);
    Assert.True(result.TrustChainValid);
    Assert.True(result.ZKPValid);

    // Employer receives result via SignalR
    // (tested separately with SignalR client)
}
```

---

## Critical Implementation Patterns

### 1. Blockchain-First (MOST IMPORTANT)

**Rule:** If it's an authorization decision, read from blockchain.

**Examples:**
- ✅ `await _blockchain.CallContractAsync<bool>("AccreditationRegistry", "hasValidAccreditation", ...)`
- ❌ `var isAuthorized = await _repository.GetAsync(issuer).IsAuthorized`

### 2. Cache is Secondary

**Pattern:**
```csharp
public async Task<Accreditation> GetAccreditationAsync(string id, bool forceRefresh = false)
{
    if (forceRefresh)
    {
        // Always provide option to bypass cache and read from blockchain
        return await _blockchain.CallContractAsync<Accreditation>(
            "AccreditationRegistry",
            "getAccreditation",
            id
        );
    }

    // Try cache first for performance
    var cached = await _repository.GetAsync(id);
    return cached;
}
```

### 3. Event-Driven Consistency

- Blockchain Sync Service is **single source** of blockchain state
- Other services update via events
- Eventual consistency acceptable (2-3 second lag)

### 4. Error Handling

**Blockchain Errors:**
```csharp
try
{
    var txHash = await _blockchain.SubmitTransactionAsync(transaction);
}
catch (SmartContractRevertException ex)
{
    // Transaction reverted - user not authorized
    throw new UnauthorizedException(ex.Message);
}
catch (RpcClientTimeoutException)
{
    // Network timeout - retry with exponential backoff
    await RetryWithBackoffAsync(() => _blockchain.SubmitTransactionAsync(transaction));
}
```

---

## Configuration Strategy

**Each service requires `appsettings.json`:**
```json
{
  "Blockchain": {
    "RpcUrl": "http://localhost:8545",
    "ChainId": 31337,
    "PrivateKey": "${PRIVATE_KEY}",
    "Contracts": {
      "EURootAuthority": {
        "Address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "AbiPath": "ABIs/EURootAuthority.json"
      },
      "AccreditationRegistry": {
        "Address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        "AbiPath": "ABIs/AccreditationRegistry.json"
      },
      "CredentialRegistry": {
        "Address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        "AbiPath": "ABIs/CredentialRegistry.json"
      }
    }
  },
  "RabbitMQ": {
    "Host": "localhost",
    "Port": 5672,
    "Username": "did_admin",
    "Password": "${RABBITMQ_PASSWORD}"
  },
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Database=did_identity;Username=did_admin;Password=${POSTGRES_PASSWORD}"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

---

## Testing Strategy

### Smart Contracts
- **Tool:** Hardhat + Chai
- **Coverage:** >90% required
- **Focus:** All authorization paths, deployment ceremony, governance

### Microservices
- **Unit Tests:** xUnit + Moq for business logic
- **Integration Tests:** TestContainers for PostgreSQL/RabbitMQ
- **Blockchain Tests:** Against Hardhat local network
- **API Tests:** WebApplicationFactory for endpoints

### End-to-End
- Complete issuance → verification flows
- Cross-border scenarios
- Revocation flows
- Independence test (mobile app verifies without backend)

---

## Success Criteria

### Phase 0
- [x] All 3 smart contracts deployed to Hardhat local network (via Docker)
- [x] ABIs exported to `blockchain/abis/`, typechain-types generated
- [x] DID.Contracts event DTO library compiling
- [x] DID.Shared.Domain / Application / Infrastructure created
- [x] All 9 .NET service projects scaffolded in solution
- [x] Docker Compose running (PostgreSQL 16, RabbitMQ 3.12, Hardhat)
- [x] ZKP Service implemented and circuits compiled

### Phase 1
- [x] Blockchain Sync Service fully implemented — polls events, saves to PostgreSQL, publishes to RabbitMQ
- [x] DB migration applied (`did_blockchainsync`)
- [ ] Identity Service creating DIDs
- [ ] Events flowing end-to-end through RabbitMQ (requires Identity + at least one consumer)

### Phase 2
- [ ] Accreditation issuance calling smart contract
- [ ] Trust chain validation reading from blockchain
- [ ] Credentials recorded on-chain

### Phase 3
- [ ] 5-step verification working
- [ ] All checks reading from blockchain
- [ ] ZKP proof generation/verification working

### Phase 4
- [ ] QR code flow working
- [ ] SignalR real-time communication functional

### Phase 5
- [ ] Email notifications working
- [ ] Audit logs capturing all events

### Phase 6
- [ ] End-to-end diploma flow working
- [ ] Cross-border verification working
- [ ] Mobile app can verify independently without backend

---

## Week-by-Week Timeline

| Week | Phase | Tasks | Deliverables |
|------|-------|-------|--------------|
| 1-2 | Phase 0 | Smart contracts (DONE), Shared infrastructure, Docker Compose | Contracts deployed, Infrastructure ready |
| 3-4 | Phase 1 | Blockchain Sync Service, Identity Service | Events syncing, DIDs being created |
| 5-6 | Phase 2 | Accreditation Service | Accreditations on blockchain |
| 6-7 | Phase 2 | Credential Service | Credentials on blockchain |
| 8 | Phase 3 | Verification Service | 5-step verification working |
| 9 | Phase 3 | ZKP Service | ZKP proofs working |
| 10 | Phase 4 | Presentation Service | QR flow working |
| 11 | Phase 5 | Notification Service | Emails sending |
| 12 | Phase 5 | Audit Service | Complete audit trail |
| 13 | Phase 6 | Integration testing | E2E scenarios passing |
| 14 | Phase 6 | Final testing & documentation | Demo ready |

---

## Next Immediate Steps

1. ✅ **Smart contracts** — compiled, tested, deployed, ABIs exported
2. ✅ **DID.Contracts** — thin event DTO library created
3. ✅ **All 8 .NET service scaffolds** — Clean Architecture structure in place
4. ✅ **Docker Compose** — configured with PostgreSQL, RabbitMQ, Hardhat
5. ✅ **ZKP Service** — circuits compiled, keys generated, cross-platform setup

6. **Start Docker and redeploy contracts:**
   ```bash
   docker-compose up -d --build
   docker-compose ps                          # wait for healthy
   cd blockchain
   npx hardhat run scripts/deploy.ts --network localhost
   # copy new addresses to each service appsettings.json
   ```

7. **Copy ABIs into solution:**
   ```bash
   mkdir DID.WalletThesis/src/ABIs
   cp blockchain/abis/*.json DID.WalletThesis/src/ABIs/
   ```

8. **Begin Phase 1 — implement Blockchain Sync Service business logic:**
   - Add NuGet packages (Nethereum, MassTransit, EF Core)
   - Implement `IBlockchainService` + `BlockchainService` (Nethereum)
   - Implement `BlockchainSyncWorker` (subscribe to contract events)
   - Implement `SyncDbContext` + migrations
   - Wire up RabbitMQ publishers

9. **Implement Identity Service in parallel with Blockchain Sync**

---

## Critical Files Reference

### Phase 0
1. **`blockchain/contracts/AccreditationRegistry.sol`** ✅ - Core trust chain validation
2. **`DID.Shared.Infrastructure/Blockchain/BlockchainService.cs`** - Foundation for all blockchain interactions
3. **`DID.Shared.Application/Interfaces/IBlockchainService.cs`** - Interface every service uses
4. **`docker-compose.yml`** - Infrastructure setup

### Phase 1
5. **`DID.BlockchainSync/API/Workers/BlockchainSyncWorker.cs`** - Bridges blockchain to microservices
6. **`DID.Identity/Application/Services/DIDService.cs`** - DID generation

### Phase 2
7. **`DID.Accreditation/Application/Services/AccreditationService.cs`** - Reference implementation of blockchain-first
8. **`DID.Credential/Application/Services/CredentialIssuanceService.cs`** - Smart contract authorization demo

### Phase 3
9. **`DID.Verification/Application/Services/VerificationOrchestrator.cs`** - 5-step verification

---

## Final Notes

- All microservices use **.NET 10** with C# 13
- **Self-contained services** — no shared Domain/Infrastructure libraries; each service owns its stack
- **DID.Contracts** is the only shared project — pure event DTO records, no logic
- Blockchain-first principle is **non-negotiable** — this is the thesis innovation
- Each service has its own PostgreSQL database/schema
- RabbitMQ + MassTransit for all async communication between services
- Smart contracts are the source of truth, always
- ZKP protects attribute-level privacy (age, dates) — not credential existence
- Mobile wallet must be able to verify credentials independently without backend services

**Remember:** The innovation of this thesis is proving that blockchain can be the authoritative source of truth for a decentralized identity system, with microservices as optional convenience layers only.
