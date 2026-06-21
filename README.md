# EU Decentralised Digital Identity System

Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iași

A blockchain-anchored, privacy-preserving digital identity prototype demonstrating hierarchical trust chains, DID-based authentication, W3C Verifiable Credentials, and zero-knowledge proofs across three platforms.

---

## Architecture

```
                       ┌───────────────────────────────┐
                       │    Ethereum (Foundry Anvil)   │
                       │                               │
                       │  EURootAuthority.sol          │
                       │  AccreditationRegistry.sol    │
                       │  CredentialRegistry.sol       │
                       │  ZkpVerifierRegistry.sol      │
                       └────────────┬──────────────────┘
                                    │
                   Source of truth for all
                   trust, authorization & ZKP vKey anchoring
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
  ┌──────────▼──────────┐ ┌─────────▼──────────────────────────────────┐
  │ Accreditation        │ │ Mobile Wallet                              │
  │ Platform             │ │                                            │
  │                      │ │ React Native/Expo · Veramo · SQLite        │
  │ Angular 21 + .NET 10 │ │ expo-secure-store · snarkjs via WebView    │
  │ DID-Auth + RBAC      │ │ Keys generated on-device, never leave      │
  │ In-browser ZKP verify│ │ Groth16 ZKP proofs generated on-device     │
  └──────────────────────┘ └────────────────────────────────────────────┘

  zkp-circuit-tools/  (build-time only — not a runtime service)
  circom 2.x + snarkjs trusted setup → .wasm / .zkey / vKey assets bundled into the mobile wallet
```

### Core Principle

**Blockchain is the source of truth — not microservices.**

- Smart contracts enforce all authorisation on-chain
- Microservices are index/relay wrappers only — they never hold or use a user's private key
- The mobile wallet generates its own `Secp256k1` keypair on-device and signs all blockchain transactions locally; the backend observes on-chain events and indexes metadata
- No centralised identity provider — authentication uses DID-Auth (challenge-response with DID key signatures)
- ZKP proofs are generated on the holder's device; the verifier (admin client) runs `snarkjs.groth16.verify()` locally in the browser using bundled verification keys — no central verification service
- ZKP verification keys are anchored on-chain via `ZkpVerifierRegistry.sol` so clients can detect tampered circuits

### Trust Hierarchy

Every arrow is enforced by smart contract logic:

```
EU Root Authority (EURootAuthority.sol — multi-sig governance, 66% approval)
  → Member State (AccreditationRegistry.sol)
    → Ministry (AccreditationRegistry.sol)
      → Institution (AccreditationRegistry.sol)
        → Department (AccreditationRegistry.sol)
    → Business Registry / Chamber of Commerce (AccreditationRegistry.sol)
      → Enterprise (AccreditationRegistry.sol)
```

---

## Platforms

### 1. Accreditation Platform (Admin Client)

The institutional control plane. Used by EU Root, member states, ministries, universities, and business registries to issue and manage accreditations, and by verifiers to verify presentations.

**Stack:** Angular 21, Tailwind CSS, .NET 10 (FastEndpoints), Nethereum, PostgreSQL, RabbitMQ + MassTransit.

**Key capabilities:**
- Hierarchical accreditation issuance and revocation (all writes signed client-side via ethers.js)
- Trust chain verification via `validateTrustChain()` on-chain
- DID-Auth login — no passwords; private key signs a challenge nonce, JWT is held in memory only (never written to Web Storage)
- Role-based access control derived from on-chain accreditation scope
- Scope-filtered sidebar and route guards (EU Root sees only Member States, etc.)
- Enterprise registration approvals and Chamber of Commerce provisioning
- In-browser ZKP proof verification: after a wallet submits a presentation, the verifier calls `snarkjs.groth16.verify(vKey, publicSignals, proof)` locally using bundled circuit verification keys

### 2. Mobile Wallet

The citizen-controlled component. All keys and sensitive data stay on-device.

**Stack:** React Native, Expo, Veramo Framework, SQLite (TypeORM), expo-secure-store, ethers.js.

**Key capabilities:**
- `Secp256k1` keypair generated on-device at wallet creation; private key stored in iOS Keychain via `expo-secure-store`
- DID management (`did:ethr`) — wallet signs its own blockchain transactions; the backend only indexes the result
- W3C Verifiable Credential storage and display (Apple Wallet-style unified card stack)
- Three account types: Personal, University, Enterprise — with account-type-conditional navigation
- Multi-step registration wizard with EU geo dataset (27 member states, NUTS-2/NUTS-3 regions)
- On-chain accreditation lookup at registration; enterprise registration request and approval polling
- PIN unlock with **Argon2id** (`m=64 MiB, t=3, p=1`) — no weak algorithm fallback
- Wrong-PIN lockout: 5 failures → 30 s cooldown; 10 failures → wallet wipe
- Biometric unlock (Face ID / Touch ID) with automatic PIN fallback; 5-minute idle re-auth
- On-device ZKP proving via hidden `WKWebView` bridge (snarkjs + WASM, Hermes-compatible) — private inputs never leave the device
- Three ZKP circuits: `ageVerification`, `graduationYearRange`, `countryMembership` (Poseidon Merkle tree, 27 EU ISO codes)
- Presentation request schema + `eudi-pres://` deep-link / QR encoding
- `PresentationConsentScreen` — builds proofs, signs the response payload with the holder's DID key (ECDSA via `ethers.signMessage`), submits to verifier
- Verifiable Presentation history persisted in AsyncStorage (profile data encrypted with AES-GCM, key derived from Argon2id PIN hash)

### 3. ZKP Circuit Toolchain

Build-time tooling only — not a runtime service. Compiles circom circuits and runs the trusted setup ceremony. Output artifacts are bundled into the mobile wallet and the admin client.

| Artifact | Description |
|----------|-------------|
| `ageVerification` | Proves age ≥ threshold without revealing date of birth |
| `graduationYearRange` | Proves graduation year within a range |
| `countryMembership` | Proves EU membership via Poseidon Merkle inclusion (depth 5) |

Each circuit produces `.wasm`, `.zkey`, and `verification_key.json`. The vKey keccak256 hashes are registered on-chain in `ZkpVerifierRegistry` at deploy time.

---

## Smart Contracts

Deployed on local Foundry Anvil with deterministic development addresses:

| Contract | Address | Purpose |
|----------|---------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Root of trust, multi-sig governance (66% approval threshold) |
| `AccreditationRegistry.sol` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Hierarchical trust chain (all scopes incl. BusinessRegistry, Enterprise) |
| `CredentialRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | Credential status and issuer accreditation validation |
| `ZkpVerifierRegistry.sol` | `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9` | On-chain vKey hash anchoring for ZKP circuits |

### Accreditation Scopes

```
0 = None
1 = MemberState
2 = Ministry
3 = Institution
4 = Department
5 = BusinessRegistry   (Chamber of Commerce / business registry)
6 = Enterprise         (issued by BusinessRegistry)
```

---

## Authentication

### Admin Client — DID-Auth + RBAC

No passwords. Users authenticate by signing a cryptographic challenge with their Ethereum private key:

1. Client requests a nonce from `POST /api/auth/challenge` (rate-limited: 10 req/min per IP)
2. Signs the nonce locally with ethers.js — private key never leaves the browser
3. Submits signature to `POST /api/auth/verify`
4. Backend recovers the signer address, queries on-chain accreditation scope, issues a short-lived JWT
5. JWT is held in an in-memory Angular service variable — never written to `localStorage` or `sessionStorage`

JWTs are validated with strict issuer and audience checks (`ValidateIssuer = true`, `ValidateAudience = true`) so a token issued for one microservice cannot be replayed against another.

### Mobile Wallet — PIN + Biometric

- `Secp256k1` keypair generated at wallet creation, stored in iOS Keychain via `expo-secure-store`
- 6-digit PIN hashed with **Argon2id** (`m=64 MiB, t=3, p=1`)
- Wrong-PIN lockout: 5 failures → 30 s cooldown; 10 failures → wallet wipe option
- Biometric (Face ID / Touch ID) with automatic PIN fallback
- Session idle timeout (5 min) triggers re-auth

---

## Backend Services

| Service | Responsibility |
|---------|---------------|
| `DID.Accreditation` | Accreditation CRUD, DID-Auth, enterprise registration approvals, RBAC |
| `DID.Credential` | Credential issuance relay, revocation, on-chain status queries |
| `DID.Identity` | DID registry index — stores public DID metadata; no auth middleware (DID resolution is a public operation per SSI standards) |
| `DID.Presentation` | Presentation session broker — stores session state and relays the raw ZKP proof to the polling verifier |
| `DID.BlockchainSync` | Subscribes to on-chain events via RabbitMQ, keeps off-chain indexes up to date |
| `DID.Notification` | Event-driven notifications |
| `DID.Audit` | Immutable audit trail |

All services share `DID.Shared` (domain primitives, `IBlockchainService` facade, `IMemoryCache`-backed challenge/session stores, `BlockchainAddressUtils`).

---

## Repository Layout

```
did-wallet-thesis/
├── blockchain/                         # Smart contracts, Foundry scripts, ABIs
│   ├── contracts/
│   │   ├── AccreditationRegistry.sol
│   │   ├── CredentialRegistry.sol
│   │   ├── EURootAuthority.sol
│   │   └── ZkpVerifierRegistry.sol
│   ├── script/Deploy.s.sol             # Deploy + register ZKP vKey hashes
│   ├── test/                           # Foundry unit tests
│   ├── abis/                           # Exported ABIs consumed by .NET services
│   └── deployments/latest.json
├── DID.WalletThesis/
│   └── src/
│       ├── admin-client/               # Angular 21 accreditation platform
│       │   └── src/app/
│       │       ├── core/auth/          # DID-Auth, JWT (in-memory), signer service, interceptor
│       │       ├── features/           # member-states, ministries, institutions, enterprises, login
│       │       └── layout/shell/       # Scope-aware sidebar
│       ├── mobile-wallet/              # React Native / Expo wallet
│       │   └── src/
│       │       ├── screens/
│       │       ├── components/         # ZkpWebViewBridge (hidden WKWebView WASM sandbox)
│       │       ├── context/
│       │       ├── services/           # pinService, zkpService, presentationService,
│       │       │                       # chainVerifier, credentialIssuer, authService, walletService
│       │       └── types/              # WalletProfile, presentation.ts
│       │   └── assets/
│       │       ├── eu-geo.json
│       │       └── circuits/           # ageVerification · graduationYearRange · countryMembership
│       │           └── {name}/         #   circuit.wasm · final.zkey · verification_key.json
│       ├── Services/
│       │   ├── DID.Accreditation/
│       │   ├── DID.BlockchainSync/
│       │   ├── DID.Identity/
│       │   ├── DID.Credential/
│       │   ├── DID.Presentation/
│       │   ├── DID.Notification/
│       │   └── DID.Audit/
│       ├── Shared/
│       │   ├── DID.Shared.Domain/
│       │   ├── DID.Shared.Application/
│       │   └── DID.Shared.Infrastructure/
│       └── zkp-service/                # Circuit build toolchain (not a runtime service)
│           ├── src/circuits/
│           ├── scripts/
│           ├── circuits_compiled/
│           └── keys/
├── docker-compose.infra.yml            # PostgreSQL, RabbitMQ, Foundry Anvil
├── docker-compose.services.yml         # Microservice containers
└── docs/
    ├── TESTING_GUIDE.md
    └── TEST_ACCOUNTS.md
```

---

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 18+
- .NET 10 SDK
- Xcode (for iOS Simulator)

### 1. Start Infrastructure

```bash
docker compose -f docker-compose.infra.yml up -d
```

Starts PostgreSQL, RabbitMQ, and Foundry Anvil. Blockchain state is persisted in the `foundry_data` Docker volume and survives restarts.

> `docker compose -f docker-compose.infra.yml down -v` wipes all volumes — you will need to redeploy contracts.

### 2. Build and Deploy Smart Contracts

On a fresh Anvil state only:

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-builder
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer
docker compose -f docker-compose.infra.yml --profile tools run --rm abi-exporter
```

Expected contract addresses after a fresh deployment:

| Contract | Address |
|----------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `AccreditationRegistry.sol` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `CredentialRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| `ZkpVerifierRegistry.sol` | `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9` |

The deployer uses Anvil account #0 (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`) — local development only.

### 3. Start Application Services

```bash
docker compose -f docker-compose.services.yml up -d --build
```

Admin client: `http://localhost:4200`

Sign in with one of the Foundry Anvil development private keys in [docs/TEST_ACCOUNTS.md](docs/TEST_ACCOUNTS.md).

### 4. Mobile Wallet

```bash
cd DID.WalletThesis/src/mobile-wallet
npm install
npx expo run:ios
```

> **Expo Go is not sufficient** — `react-native-argon2` and snarkjs WASM require a native build.

See [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for end-to-end testing instructions.

### Daily Development Flow

When contracts are already deployed and Anvil state exists:

```bash
docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.services.yml up -d
```

---

## Common Commands

| Action | Command |
|--------|---------|
| Start infrastructure | `docker compose -f docker-compose.infra.yml up -d` |
| Stop infrastructure (keep data) | `docker compose -f docker-compose.infra.yml stop` |
| Wipe all data | `docker compose -f docker-compose.infra.yml down -v` |
| Build contracts | `docker compose -f docker-compose.infra.yml --profile tools run --rm contract-builder` |
| Deploy contracts | `docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer` |
| Export ABIs | `docker compose -f docker-compose.infra.yml --profile tools run --rm abi-exporter` |
| Start services | `docker compose -f docker-compose.services.yml up -d --build` |
| Run blockchain tests | `cd blockchain && forge test` |

### Verify contract deployment

```bash
docker run --rm -it \
  --entrypoint cast \
  --network did-infra \
  ghcr.io/foundry-rs/foundry:latest \
  code 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 \
  --rpc-url http://foundry:8545
```

Non-`0x` output confirms the contract exists on the local chain.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solidity 0.8, Foundry, Anvil |
| Backend | .NET 10, FastEndpoints, Entity Framework Core, Nethereum, MassTransit |
| Event bus | RabbitMQ |
| Database | PostgreSQL (per-service, EF Core migrations) |
| Admin client | Angular 21, Tailwind CSS, ethers.js, snarkjs |
| Mobile wallet | React Native, Expo, Veramo, TypeORM, expo-secure-store, ethers.js |
| ZKP | circom 2.x, snarkjs, Groth16, Poseidon hash |
| DID method | `did:ethr` (EIP-1056), Secp256k1 |
| Credential format | W3C Verifiable Credentials (JWT proofs) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `eth_call` fails | Foundry Anvil is not running: `docker compose -f docker-compose.infra.yml up -d foundry` |
| Contract code returns `0x` | Contracts not deployed — run `contract-deployer` profile |
| Chain resets to block 0 after restart | `foundry_data` volume was deleted — redeploy contracts |
| Services cannot reach blockchain | Use `http://foundry:8545` for container-to-container RPC |
| Browser / mobile cannot reach blockchain | Use `http://localhost:8545` from the host |
| ABI errors in .NET services | Rebuild contracts and run `abi-exporter` |
| Mobile wallet PIN fails after reinstall | `expo-secure-store` data is tied to the app install — expected; create a new wallet |

---

## Standards Alignment

| Standard | Status |
|----------|--------|
| W3C DID Core 1.0 | Implemented |
| W3C VC Data Model 1.1 | Implemented |
| did:ethr Method Specification / EIP-1056 | Implemented |
| eIDAS 2.0 trust hierarchy model | Implemented (EU Root → Member State → Institution chain) |
| OpenID4VP / OpenID4VCI | Partial — custom `eudi-pres://` protocol; OpenID4VP conformance planned |
| SD-JWT | Not implemented |
| EUDI ARF | Aligned in trust model; full ARF conformance not in scope |

---

## License

Bachelor's thesis project. Academic use.
