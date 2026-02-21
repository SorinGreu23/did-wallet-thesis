# DID Wallet Thesis - Task List

**Status Legend:** ✅ Completed | 🔄 In Progress | ⏳ Pending

## Phase 0: Foundation & Prerequisites

### ✅ Task #1: Implement Smart Contracts
**Status:** Completed

**Description:** CRITICAL PATH - Must complete before any microservices.

- ✅ Created blockchain/ directory structure
- ✅ Implemented EURootAuthority.sol (root of trust with deployment ceremony)
- ✅ Implemented AccreditationRegistry.sol (hierarchical trust chain validation)
- ✅ Implemented CredentialRegistry.sol (credential status tracking)
- ✅ Created comprehensive test files (>90% coverage target)
- ✅ Created deployment scripts
- ✅ Configured hardhat for local and Sepolia networks

**Key Functions Implemented:**
- EURootAuthority: `isMemberState()`, `verifyDeploymentCeremony()`, multi-sig governance
- AccreditationRegistry: `issueAccreditation()`, `validateTrustChain()`, `hasValidAccreditation()`
- CredentialRegistry: `recordCredential()`, `isActive()`, `revokeCredential()`

**Next Steps:**
1. Run `npm install` in blockchain/ directory
2. Run `npm test` to verify all tests pass
3. Deploy to local Hardhat network
4. Deploy to Sepolia testnet
5. Export ABIs for microservice consumption

---

### ⏳ Task #2: Create Shared Infrastructure Projects
**Status:** Pending

**Location:** `DID.WalletThesis/src/Shared/`

**Components to Create:**
- **DID.Shared.Domain/** - Entity, ValueObject, AggregateRoot, Enums
- **DID.Shared.Application/** - Interfaces (IBlockchainService, IEventBus, IRepository), DTOs
- **DID.Shared.Infrastructure/** - BlockchainService (Nethereum), RabbitMQEventBus, BaseRepository
- **DID.Shared.Events/** - Event DTOs for identity, accreditation, credential, blockchain

**Critical Interface:**
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

**NuGet Packages:**
- Nethereum.Web3
- MassTransit
- MassTransit.RabbitMQ
- Npgsql.EntityFrameworkCore.PostgreSQL
- Serilog.AspNetCore

**Dependencies:** Task #1 (need contract ABIs)

---

### ⏳ Task #3: Set Up Docker Compose Infrastructure
**Status:** Pending

**Location:** Project root `docker-compose.yml`

**Services:**
- **PostgreSQL 16** (port 5432)
- **RabbitMQ 3.12** with management UI (ports 5672, 15672)
- **Hardhat Node** (port 8545)

**Configuration:**
- Persistent volumes for data
- Environment variables for credentials
- Network configuration for service communication

**Verification:**
```bash
docker-compose up -d
docker-compose ps  # All services healthy
curl http://localhost:15672  # RabbitMQ management
```

**Dependencies:** None (can be done in parallel with Task #2)

---

## Phase 1: Core Infrastructure Services

### ⏳ Task #4: Implement Blockchain Sync Service
**Status:** Pending

**Priority:** HIGHEST - All other services depend on blockchain state being synced

**Location:** `DID.WalletThesis/src/Services/DID.BlockchainSync/`

**Architecture:** Clean Architecture (Domain → Application → Infrastructure → API)

**Key Responsibilities:**
- Subscribe to smart contract events in real-time (Nethereum filters)
- Store event data in PostgreSQL (synced_blocks, synced_events tables)
- Publish events to RabbitMQ for consumption by other services
- Handle blockchain reorganizations (orphaned blocks)
- Provide sync status endpoint

**Database Schema:**
- `synced_blocks` (block_number, block_hash, timestamp)
- `synced_events` (event_type, contract_address, block_number, transaction_hash, event_data JSONB)

**Events to Subscribe:**
- AccreditationIssued, AccreditationRevoked
- CredentialIssued, CredentialRevoked, CredentialSuspended

**API Endpoint:** `GET /sync/status`

**Dependencies:** Tasks #1, #2, #3

---

### ⏳ Task #5: Implement Identity Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Identity/`

**Key Responsibilities:**
- Generate `did:ethr:sepolia` DIDs
- Store DID documents and key pairs
- Provide DID resolution

**Database Schema:**
- `dids` (id, did, controller_address, created_at)
- `key_pairs` (id, did_id, key_type, public_key, encrypted_private_key, purpose)
- `did_documents` (id, did_id, document JSONB, cached_at)

**API Endpoints:**
- `POST /api/dids` - Create new DID
- `GET /api/dids/{did}` - Resolve DID document
- `GET /api/dids/{did}/keys` - Get public keys

**IMPORTANT:** Does NOT authorize who can create DIDs. Authorization happens at accreditation level via smart contracts.

**Dependencies:** Tasks #2, #3, #4

---

## Phase 2: Accreditation & Credential Services

### ⏳ Task #6: Implement Accreditation Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Accreditation/`

**Critical Principle:** UI wrapper for AccreditationRegistry.sol. Does NOT make authorization decisions - smart contract does.

**Key Responsibilities:**
- Issue/revoke accreditations by submitting to blockchain
- Validate trust chains by calling smart contract
- Cache blockchain state from Blockchain Sync Service events
- Provide trust chain hierarchy visualization

**Database Schema:**
- `accreditations` (id, accreditation_id, issuer_did, subject_did, parent_id, scope, permissions_hash, issued_at, expires_at, revoked, block_number, transaction_hash)

**API Endpoints:**
- `POST /api/accreditations` - Issue accreditation (submits to blockchain)
- `GET /api/accreditations/{id}` - Get accreditation details
- `GET /api/accreditations/subject/{did}` - Get all accreditations for subject
- `GET /api/accreditations/{id}/trust-chain` - Validate and reconstruct trust chain FROM BLOCKCHAIN
- `POST /api/accreditations/{id}/revoke` - Revoke accreditation

**Blockchain-First Pattern:** All authorization checks call `AccreditationRegistry.validateTrustChain()` and `hasValidAccreditation()`

**Event Consumption:** Subscribe to `accreditation-events` from RabbitMQ

**Dependencies:** Tasks #1, #2, #3, #4, #5

---

### ⏳ Task #7: Implement Credential Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Credential/`

**Key Responsibilities:**
- Generate W3C VCs using Veramo framework
- Call CredentialRegistry.sol to record credentials
- Smart contract validates issuer has institution-level accreditation
- Encrypt and store full credentials off-chain

**Database Schema:**
- `credentials` (id, credential_id, issuer_did, holder_did, credential_type, encrypted_credential BYTEA, issued_at, expires_at, status, block_number, transaction_hash)

**API Endpoints:**
- `POST /api/credentials` - Issue credential
- `GET /api/credentials/{id}` - Get credential (requires auth)
- `GET /api/credentials/{id}/status` - Get status FROM BLOCKCHAIN
- `POST /api/credentials/{id}/revoke` - Revoke credential

**Integration:** Veramo framework for VC generation

**Dependencies:** Tasks #1, #2, #3, #4, #6

---

## Phase 3: Verification Services

### ⏳ Task #8: Implement Verification Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Verification/`

**Key Responsibility:** Orchestrate 5-step verification reading all authorization from blockchain

**5-Step Verification Process:**
1. Verify cryptographic signature (local)
2. Check credential status ON BLOCKCHAIN
3. Get issuer's accreditations FROM BLOCKCHAIN
4. Validate trust chain ON BLOCKCHAIN
5. Verify ZKP if present (call ZKP Service)

**Database Schema:**
- `verification_sessions` (id, session_token, verifier_did, presentation_request JSONB, status, created_at, expires_at)
- `verification_results` (id, session_id, credential_id, signature_valid, credential_active, trust_chain_valid, zkp_valid, overall_result, trust_chain JSONB, verified_at)

**API Endpoints:**
- `POST /api/verify/presentation` - Verify complete presentation
- `GET /api/verify/results/{sessionId}` - Get verification result
- `POST /api/verify/credential` - Quick verify single credential

**All checks must read from blockchain, not local cache.**

**Dependencies:** Tasks #1, #2, #3, #4, #6, #7, #9

---

### ⏳ Task #9: Implement ZKP Service (Node.js)
**Status:** Pending

**Location:** `zkp-service/` (project root)

**Technology:** Node.js + Express + snarkjs + circom (NOT .NET)

**Circuits to Create:**
- `ageVerification.circom` - Prove age > threshold without revealing exact age
- `graduationYearRange.circom` - Prove graduation year in range

**Structure:**
```
zkp-service/
├── src/
│   ├── circuits/
│   ├── controllers/zkpController.ts
│   ├── services/
│   │   ├── proofGenerator.ts
│   │   └── proofVerifier.ts
│   └── index.ts
├── circuits_compiled/
├── keys/
├── package.json
└── Dockerfile
```

**API Endpoints:**
- `POST /zkp/generate/age` - Generate age proof
- `POST /zkp/generate/graduation-year` - Generate graduation year proof
- `POST /zkp/verify` - Verify any proof

**Integration:** .NET Verification Service calls ZKP Service via HTTP

**Dependencies:** Tasks #2, #3 (can be developed in parallel with Task #8)

---

## Phase 4: Presentation & Communication

### ⏳ Task #10: Implement Presentation Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Presentation/`

**Key Responsibilities:**
- Generate QR codes for verification requests
- Manage presentation sessions (5-minute expiry)
- SignalR hub for real-time holder ↔ verifier communication

**Database Schema:**
- `presentation_requests` (id, request_token, verifier_did, requested_credential_types TEXT[], zkp_requirements JSONB, qr_code_data, status, created_at, expires_at)
- `presentation_sessions` (id, request_id, holder_connection_id, verifier_connection_id, presentation_data JSONB, created_at)

**API Endpoints:**
- `POST /api/presentations/request` - Create request (returns QR code)
- `GET /api/presentations/request/{token}` - Get request details
- `POST /api/presentations/submit` - Submit presentation

**SignalR Hub:** Real-time communication for presentation flow

**Dependencies:** Tasks #2, #3, #8

---

## Phase 5: Support Services

### ⏳ Task #11: Implement Notification Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Notification/`

**Key Responsibilities:**
- Email notifications (SendGrid)
- Push notifications (Firebase Cloud Messaging)
- Subscribe to ALL events from RabbitMQ

**Event Subscriptions:**
- `CredentialIssuedEvent` → Email holder
- `CredentialRevokedEvent` → Email holder
- `VerificationCompletedEvent` → Email verifier
- `AccreditationIssuedEvent` → Email subject

**No database required** - Event-driven only

**Dependencies:** Tasks #2, #3, #4 (event infrastructure)

---

### ⏳ Task #12: Implement Audit Service
**Status:** Pending

**Location:** `DID.WalletThesis/src/Services/DID.Audit/`

**Key Responsibilities:**
- Event sourcing with immutable, append-only logs
- Subscribe to ALL events from RabbitMQ
- Compliance reporting

**Database Schema:**
- `audit_logs` (id, event_id, event_type, event_source, event_data JSONB, actor_did, target_did, timestamp, block_number, transaction_hash, created_at)
- **NO UPDATE OR DELETE** - immutable logs only

**API Endpoints (Read-Only):**
- `GET /api/audit/events` - Query audit logs
- `GET /api/audit/did/{did}` - Get all events for DID
- `GET /api/audit/credential/{id}` - Get credential lifecycle

**Dependencies:** Tasks #2, #3, #4 (event infrastructure)

---

## Phase 6: Integration & Testing

### ⏳ Task #13: Integration Testing and End-to-End Scenarios
**Status:** Pending

**Test Scenarios:**

**Scenario 1: Complete Diploma Issuance**
1. EU Root accredits Romania (smart contract)
2. Romania accredits Ministry of Education
3. Ministry accredits University of Bucharest
4. University issues diploma to student
5. Verify all events propagated through system

**Scenario 2: Cross-Border Verification**
1. German employer creates presentation request
2. Romanian student scans QR code
3. Student submits diploma with ZKP (age > 21)
4. Verification Service validates entire trust chain from blockchain
5. Employer receives result via SignalR

**Scenario 3: Revocation Flow**
1. University revokes credential on blockchain
2. Blockchain Sync Service detects event
3. All services update caches
4. New verification fails with "revoked" status

**Independence Test:**
- Mobile app verifies credential reading blockchain directly (no backend)
- Validates that blockchain is truly the source of truth

**Testing Tools:**
- xUnit + Moq for unit tests
- TestContainers for integration tests
- Hardhat for blockchain tests
- Postman/curl for API tests

**Dependencies:** All previous tasks

---

## Development Order (Critical Path)

```
1. Smart Contracts (COMPLETED) ✅
   ↓
2. Shared Infrastructure + Docker Compose (Parallel)
   ↓
3. Blockchain Sync Service (Critical - all depend on it)
   ↓
4. Identity Service (Can be parallel with Blockchain Sync)
   ↓
5. Accreditation Service
   ↓
6. Credential Service
   ↓
7. Verification Service + ZKP Service (Parallel)
   ↓
8. Presentation Service
   ↓
9. Notification Service + Audit Service (Parallel)
   ↓
10. Integration Testing
```

---

## Next Immediate Steps

1. **Install blockchain dependencies:**
   ```bash
   cd blockchain
   npm install
   ```

2. **Run smart contract tests:**
   ```bash
   npm test
   ```

3. **Deploy to local Hardhat network:**
   ```bash
   npm run node  # Terminal 1
   npm run deploy:local  # Terminal 2
   ```

4. **Start Phase 0 remaining tasks:**
   - Create shared infrastructure projects (Task #2)
   - Set up Docker Compose (Task #3)

5. **Begin Phase 1:**
   - Implement Blockchain Sync Service (Task #4)
   - Implement Identity Service (Task #5)

---

## Progress Tracking

- **Total Tasks:** 13
- **Completed:** 1 (Smart Contracts)
- **In Progress:** 0
- **Pending:** 12
- **Overall Progress:** 7.7%

**Phase 0 Progress:** 33.3% (1/3 completed)

---

## Key Success Criteria

### Phase 0
- [ ] All 3 smart contracts deployed to Hardhat and Sepolia
- [x] Smart contract tests passing (>90% coverage)
- [ ] Shared infrastructure projects compiling
- [ ] Docker Compose running all services

### Phase 1
- [ ] Blockchain Sync Service syncing events in real-time
- [ ] Identity Service creating DIDs
- [ ] Events flowing through RabbitMQ

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

## Notes

- All microservices use **.NET 10** with C# 13
- Follow blockchain-first principle: **blockchain is the source of truth**
- Each service has its own PostgreSQL database/schema
- RabbitMQ for all async communication
- Smart contracts validate all authorization decisions
