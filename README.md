# EU Decentralized Digital Identity System

Note: Outdated file, will be updated via the next pull request.

Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iasi

A blockchain-anchored, privacy-preserving digital identity prototype demonstrating hierarchical trust chains, DID-based authentication, and W3C Verifiable Credentials across three platforms.

## Architecture

```
                        ┌──────────────────────────┐
                        │   Ethereum (Hardhat /     │
                        │       Sepolia)            │
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

Deployed on local Hardhat (deterministic addresses):

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
├── blockchain/                         # Smart contracts, deploy scripts, ABIs
│   ├── contracts/                      # Solidity sources
│   ├── scripts/deploy.ts              # Deployment + bootstrap
│   └── abis/                          # Exported ABIs for services
├── DID.WalletThesis/
│   └── src/
│       ├── admin-client/              # Angular 21 accreditation platform
│       │   └── src/app/
│       │       ├── core/auth/         # DID-Auth service, guards, interceptor
│       │       ├── features/          # member-states, ministries, universities, login
│       │       └── shared/            # Reusable components
│       ├── Services/
│       │   ├── DID.Accreditation/     # Accreditation API + auth endpoints
│       │   ├── DID.BlockchainSync/    # Event polling + RabbitMQ publisher
│       │   ├── DID.Identity/          # DID generation service
│       │   └── DID.Credential/        # Credential API (stub)
│       ├── Shared/
│       │   ├── DID.Shared.Domain/     # DDD base classes
│       │   ├── DID.Shared.Application/# Interfaces (IBlockchainService, IEventBus)
│       │   └── DID.Shared.Infrastructure/ # Nethereum, MassTransit, EF Core
│       └── Contracts/DID.Contracts/   # RabbitMQ event DTOs
├── mobile-wallet/                     # React Native/Expo mobile app
│   └── src/
│       ├── agents/veramoAgent.ts      # Veramo agent (DID, keys, credentials)
│       ├── context/AuthContext.tsx     # Auth state + wallet creation
│       ├── screens/                   # WelcomeScreen, HomeScreen, etc.
│       └── services/                  # DID, credential, auth, wallet services
├── docker-compose.infra.yml           # PostgreSQL, RabbitMQ, Hardhat
├── docker-compose.services.yml        # Microservice containers
├── TESTING_GUIDE.md                   # Step-by-step testing instructions
└── CLAUDE.md                          # AI coding assistant instructions
```

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 18+
- .NET 10 SDK
- Xcode (for iOS Simulator)

### 1. Infrastructure

```bash
docker compose -f docker-compose.infra.yml up -d
cd blockchain && npx hardhat run scripts/deploy.ts --network localhost
docker exec did-postgres psql -U did_user -d postgres -c "CREATE DATABASE did_accreditation;"
```

### 2. Accreditation Platform

```bash
# Backend
cd DID.WalletThesis && dotnet run --project src/Services/DID.Accreditation

# Frontend (separate terminal)
cd DID.WalletThesis/src/admin-client && npm install && npm start
```

Open `http://localhost:4200` and sign in with a Hardhat account private key.

### 3. Mobile Wallet

```bash
cd mobile-wallet && npm install && npx expo start --ios
```

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed end-to-end testing instructions with test accounts and expected behaviors.

## Technical Details

- **DID method:** `did:ethr:sepolia` with Secp256k1 keys
- **Credential format:** W3C Verifiable Credentials with JWT proofs
- **Mobile storage:** SQLite via expo-sqlite + TypeORM, keys in expo-secure-store
- **Event bus:** RabbitMQ + MassTransit
- **Blockchain interaction:** Nethereum (.NET), ethers.js (Angular/Wallet)

## Standards Alignment

**Implemented:** W3C DID Core 1.0, W3C VC Data Model 1.1, did:ethr Method Specification, EIP-1056.

**Planned:** OpenID4VP, OpenID4VCI, SD-JWT, eIDAS 2.0 / EBSI Trust Framework.

## License

Bachelor's thesis project. Academic use.
