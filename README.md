# EU Decentralized Digital Identity System

Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iasi

A blockchain-anchored, privacy-preserving digital identity prototype demonstrating hierarchical trust chains, DID-based authentication, and W3C Verifiable Credentials across three platforms.

## Architecture

```
                        ┌───────────────────────────┐
                        │    Ethereum (Foundry      │
                        │    Anvil / Sepolia)       │
                        │                           │
                        │  EURootAuthority.sol      │
                        │  AccreditationRegistry.sol│
                        │  CredentialRegistry.sol   │
                        └────────────┬──────────────┘
                                     │
                    Source of truth for all
                    trust & authorization
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
   ┌──────────▼─────────┐ ┌─────────▼──────────┐ ┌────────▼────────┐
   │ Accreditation       │ │ Mobile Wallet      │ │ Verifier        │
   │ Platform            │ │                    │ │ Platform        │
   │                     │ │ React Native/Expo  │ │ (planned)       │
   │ Angular 21 + .NET 10│ │ Veramo + SQLite    │ │                 │
   │ DID-Auth + RBAC     │ │ expo-secure-store  │ │                 │
   └─────────────────────┘ └────────────────────┘ └─────────────────┘
```

### Core Principle

**Blockchain is the source of truth — not microservices.**

- Smart contracts enforce all authorization on-chain
- Microservices are convenience wrappers only (indexing, relaying, UI helpers)
- The mobile wallet can verify credentials independently by reading the blockchain
- No centralized identity provider — authentication uses DID-Auth (challenge-response with DID key signatures)

### Trust Hierarchy

Every arrow is enforced by smart contract logic:

```
EU Root Authority (EURootAuthority.sol — multi-sig governance, 66% approval)
  → Member State (AccreditationRegistry.sol — checks isMemberState())
    → Ministry (AccreditationRegistry.sol — validates parent chain)
      → Institution (AccreditationRegistry.sol — validates parent chain)
        → Credential (CredentialRegistry.sol — validates issuer accreditation)
```

## Platforms

### 1. Accreditation Platform

The institutional control plane. Used by EU Root, member states, ministries, and universities.

| Feature | Status |
|---------|--------|
| Hierarchical accreditation issuance (on-chain) | Done |
| Trust chain verification via `validateTrustChain()` | Done |
| Revocation and inspection | Done |
| DID-Auth login (challenge-response, no passwords) | Done |
| Role-based access control derived from on-chain scope | Done |
| Admin UI with scope-filtered navigation | Done |

**Stack:** Angular 21, Tailwind CSS, .NET 10 (FastEndpoints), Nethereum, PostgreSQL, RabbitMQ + MassTransit.

### 2. Mobile Wallet

The citizen-controlled component. Holds keys locally, manages DIDs and credentials.

| Feature | Status |
|---------|--------|
| DID creation and management (`did:ethr:sepolia`) | Done |
| Key storage in iOS Keychain (expo-secure-store) | Done |
| W3C Verifiable Credential storage and display | Done |
| Biometric-gated identity view (Face ID / Touch ID) | Done |
| Wallet creation flow with secure key generation | Done |
| Auto-login bypass for returning users | Done |
| ZKP-backed selective disclosure | Planned |
| QR-based credential presentation | Planned |

**Stack:** React Native, Expo, Veramo Framework, SQLite (TypeORM), expo-secure-store.

### 3. Verifier Platform (planned)

The relying-party interface for banks, employers, and academic institutions. Validates credentials, trust chains, and ZKP proofs directly against the blockchain.

## Smart Contracts

Deployed on local Foundry Anvil with deterministic development addresses:

| Contract | Address | Purpose |
|----------|---------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Root of trust, deployment ceremony, multi-sig governance |
| `AccreditationRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | Hierarchical trust chain, `validateTrustChain(bytes32)` |
| `CredentialRegistry.sol` | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | Credential status, issuer accreditation validation |

## Authentication

### Admin Client — DID-Auth + RBAC

No passwords. Users authenticate by signing a cryptographic challenge with their Ethereum private key:

1. Client requests a nonce from `POST /api/auth/challenge`
2. Signs the nonce locally with ethers.js (private key never leaves the browser)
3. Submits signature to `POST /api/auth/verify`
4. Backend recovers the signer address, queries on-chain accreditation scope, issues a JWT

The JWT contains the DID's on-chain scope (`EURoot`, `MemberState`, `Ministry`, `Institution`), which drives:

- **Route guards** — each route requires a minimum scope
- **Sidebar filtering** — users only see routes they're authorized for
- **Backend policies** — endpoints enforce scope via `[Authorize]` policies

### Mobile Wallet — Secure Storage

- Secret key generated at wallet creation, stored in iOS Keychain via `expo-secure-store`
- Returning users bypass the welcome screen automatically
- Biometric authentication (Face ID / Touch ID) gates sensitive operations

## Repository Layout

```
did-wallet-thesis/
├── blockchain/                         # Smart contracts, Foundry scripts, ABIs
│   ├── contracts/                      # Solidity sources
│   ├── script/Deploy.s.sol             # Foundry deployment script
│   ├── abis/                           # Exported ABIs for services
│   ├── foundry.toml                    # Foundry configuration
│   └── export-abis.js                  # ABI export helper
├── DID.WalletThesis/
│   └── src/
│       ├── admin-client/               # Angular 21 accreditation platform
│       │   └── src/app/
│       │       ├── core/auth/          # DID-Auth service, guards, interceptor
│       │       ├── features/           # member-states, ministries, universities, login
│       │       └── shared/             # Reusable components
│       ├── mobile-wallet/              # React Native/Expo mobile app
│       │   └── src/
│       │       ├── agents/veramoAgent.ts   # Veramo agent (DID, keys, credentials)
│       │       ├── context/AuthContext.tsx # Auth state + wallet creation
│       │       ├── screens/                # WelcomeScreen, HomeScreen, etc.
│       │       └── services/               # DID, credential, auth, wallet services
│       ├── Services/
│       │   ├── DID.Accreditation/      # Accreditation API + auth endpoints
│       │   ├── DID.BlockchainSync/     # Event polling + RabbitMQ publisher
│       │   ├── DID.Identity/           # DID generation service
│       │   └── DID.Credential/         # Credential API (stub)
│       ├── Shared/
│       │   ├── DID.Shared.Domain/      # DDD base classes
│       │   ├── DID.Shared.Application/ # Interfaces (IBlockchainService, IEventBus)
│       │   └── DID.Shared.Infrastructure/ # Nethereum, MassTransit, EF Core
│       └── Contracts/DID.Contracts/    # RabbitMQ event DTOs
├── docker-compose.infra.yml            # PostgreSQL, RabbitMQ, Foundry Anvil, blockchain tooling
├── docker-compose.services.yml         # Microservice containers
├── docs/TESTING_GUIDE.md               # Step-by-step testing instructions
└── CLAUDE.md                           # AI coding assistant instructions
```

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

This starts the persistent infrastructure layer:

- PostgreSQL
- RabbitMQ
- Foundry Anvil local chain

Foundry Anvil stores its local blockchain state in the `foundry_data` Docker volume. This means deployed contracts and on-chain accreditation data survive normal container restarts.

Do not run this unless you intentionally want to wipe all persisted infrastructure data:

```bash
docker compose -f docker-compose.infra.yml down -v
```

`down -v` deletes the Docker volumes for Postgres, RabbitMQ, and Foundry Anvil.

### 2. Build Smart Contracts

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-builder
```

This runs `forge build` inside the `blockchain/` workspace.

### 3. Deploy Smart Contracts

Deploy contracts only when starting from a fresh Anvil state:

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer
```

The deployer runs:

```bash
forge script script/Deploy.s.sol --rpc-url http://foundry:8545 --broadcast
```

The local deployer uses Anvil's default development private key unless `ANVIL_PRIVATE_KEY` is set:

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This key is only for local development. Never use real private keys in this setup.

Expected local contract addresses:

| Contract | Address |
|----------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `AccreditationRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| `CredentialRegistry.sol` | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |

Because Anvil state is persisted, contracts do not need to be redeployed after normal restarts.

### 4. Export Contract ABIs

The .NET services read contract ABIs from:

```text
blockchain/abis/
```

After changing or rebuilding contracts, export ABIs with:

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm abi-exporter
```

This runs `node export-abis.js` inside the `blockchain/` workspace.

### 5. Start Application Services

```bash
docker compose -f docker-compose.services.yml up -d --build
```

Open `http://localhost:4200` and sign in with one of the default Foundry Anvil development private keys.

### 6. Mobile Wallet

```bash
cd DID.WalletThesis/src/mobile-wallet
npm install
npx expo start --ios
```

See [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for detailed end-to-end testing instructions with test accounts and expected behaviors.

### Daily Development Flow

If the Anvil state already exists and contracts are already deployed, the usual startup flow is:

```bash
docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.services.yml up -d
```

Stop everything while keeping data:

```bash
docker compose -f docker-compose.services.yml stop
docker compose -f docker-compose.infra.yml stop
```

## Common Commands

### Start infrastructure

```bash
docker compose -f docker-compose.infra.yml up -d
```

### Stop infrastructure but keep data

```bash
docker compose -f docker-compose.infra.yml stop
```

### Wipe all infrastructure data

```bash
docker compose -f docker-compose.infra.yml down -v
```

### Build contracts

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-builder
```

### Deploy contracts

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer
```

### Export ABIs

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm abi-exporter
```

### Start application services

```bash
docker compose -f docker-compose.services.yml up -d --build
```

### Verify contract deployment

```bash
docker run --rm -it   --entrypoint cast   --network did-infra   ghcr.io/foundry-rs/foundry:latest   code 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9   --rpc-url http://foundry:8545
```

If the output is not `0x`, the contract exists on the local chain.

## Technical Details

- **DID method:** `did:ethr:sepolia` with Secp256k1 keys
- **Credential format:** W3C Verifiable Credentials with JWT proofs
- **Mobile storage:** SQLite via expo-sqlite + TypeORM, keys in expo-secure-store
- **Event bus:** RabbitMQ + MassTransit
- **Blockchain interaction:** Nethereum (.NET), ethers.js (Angular/Wallet), Foundry Anvil for local development

## Troubleshooting

| Problem | Fix |
|---|---|
| `eth_call` fails | Make sure Foundry Anvil is running: `docker compose -f docker-compose.infra.yml up -d foundry` |
| Contract code returns `0x` | Contracts are not deployed on the current Anvil state. Run `docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer`. |
| Chain resets to block `0` after restart | Check that `foundry_data` was not deleted with `docker compose -f docker-compose.infra.yml down -v`. |
| Services cannot reach blockchain | Make sure service configs use `http://foundry:8545` for container-to-container RPC. |
| Browser cannot reach blockchain | Use `http://localhost:8545` from the host/browser. |
| ABI errors in .NET services | Rebuild contracts and run `docker compose -f docker-compose.infra.yml --profile tools run --rm abi-exporter`. |

## Standards Alignment

**Implemented:** W3C DID Core 1.0, W3C VC Data Model 1.1, did:ethr Method Specification, EIP-1056.

**Planned:** OpenID4VP, OpenID4VCI, SD-JWT, eIDAS 2.0 / EBSI Trust Framework.

## License

Bachelor's thesis project. Academic use.
