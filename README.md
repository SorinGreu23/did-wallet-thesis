# EU Decentralized Digital Identity System

Last updated: May 10, 2026

Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iasi

A blockchain-anchored, privacy-preserving digital identity prototype demonstrating hierarchical trust chains, DID-based authentication, W3C Verifiable Credentials, and zero-knowledge proofs across three platforms.

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
   ┌──────────▼─────────┐ ┌─────────▼──────────────────────────────────┐
   │ Accreditation       │ │ Mobile Wallet                              │
   │ Platform            │ │                                            │
   │                     │ │ React Native/Expo | Veramo | SQLite        │
   │ Angular 21 + .NET 10│ │ expo-secure-store | snarkjs via WebView    │
   │ DID-Auth + RBAC     │ │ Groth16 ZKP proofs never leave the device  │
   └─────────────────────┘ └────────────────────────────────────────────┘

  zkp-circuit-tools/  (build-time only — not a runtime service)
  circom 2.x + snarkjs trusted setup → .wasm / .zkey / vKey assets bundled into the mobile wallet
```

### Core Principle

**Blockchain is the source of truth — not microservices.**

- Smart contracts enforce all authorization on-chain
- Microservices are convenience wrappers only (indexing, relaying, UI helpers)
- The mobile wallet can verify credentials independently by reading the blockchain directly
- No centralized identity provider — authentication uses DID-Auth (challenge-response with DID key signatures)
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

## Platforms

### 1. Accreditation Platform (Admin Client)

The institutional control plane. Used by EU Root, member states, ministries, universities, and business registries.

| Feature | Status |
|---------|--------|
| Hierarchical accreditation issuance (on-chain) | ✅ Done |
| Trust chain verification via `validateTrustChain()` | ✅ Done |
| Revocation and inspection | ✅ Done |
| DID-Auth login (challenge-response, no passwords) | ✅ Done |
| Role-based access control from on-chain scope | ✅ Done |
| Scope-filtered sidebar (EU Root sees only Member States) | ✅ Done |
| `BusinessRegistry` and `Enterprise` scope support on-chain | ✅ Done |
| Chamber-of-Commerce provisioning UI (Member State view) | ✅ Done |
| Enterprise registration approvals route (`/enterprises`) | ✅ Done |

**Stack:** Angular 21, Tailwind CSS, .NET 10 (FastEndpoints), Nethereum, PostgreSQL, RabbitMQ + MassTransit.

### 2. Mobile Wallet

The citizen-controlled component. Holds keys locally, manages DIDs, credentials, and account types.

| Feature | Status |
|---------|--------|
| DID creation and management (`did:ethr`) | ✅ Done |
| Key storage in iOS Keychain (`expo-secure-store`) | ✅ Done |
| W3C Verifiable Credential storage and display | ✅ Done |
| Biometric-gated identity view (Face ID / Touch ID) | ✅ Done |
| Three account types: Personal, University, Enterprise | ✅ Done |
| Multi-step registration wizard per account type | ✅ Done |
| EU geo dataset (27 member states, NUTS-2/NUTS-3) | ✅ Done |
| PIN unlock — Argon2id in native builds, SHA-256 fallback in Expo Go | ✅ Done |
| On-chain accreditation lookup at registration | ✅ Done |
| Enterprise registration request + polling | ✅ Done |
| Bottom tab navigator (`@react-navigation/bottom-tabs`) | ✅ Done |
| Account-type-conditional tabs (Wallet hidden for University/Enterprise) | ✅ Done |
| On-device ZKP proving via hidden WebView bridge (snarkjs + WASM, Hermes-compatible) | ✅ Done |
| Presentation request schema + `eudi-pres://` QR encoding | ✅ Done |
| `PresentationConsentScreen` (holder side) with pre-proof validation | ✅ Done |
| `IncomingPresentationScreen` (verifier side) | ✅ Done |
| `chainVerifier` + `credentialIssuer` helpers | ✅ Done |
| Verifiable Presentation history persisted in AsyncStorage | ✅ Done |
| Unified Apple Wallet-style card stack (VCs + VPs combined) | ✅ Done |

**Stack:** React Native, Expo, Veramo Framework, SQLite (TypeORM), expo-secure-store, ethers.js.

### 3. ZKP Circuit Toolchain

Build-time tooling only — not a runtime service. Compiles circom circuits and runs the trusted setup ceremony. Output artifacts are bundled directly into the mobile wallet. All proof generation and verification happens on-device.

| Artifact | Status |
|---------|--------|
| `ageVerification` circuit + `.wasm` / `.zkey` / vKey | ✅ Done |
| `graduationYearRange` circuit + `.wasm` / `.zkey` / vKey | ✅ Done |
| `countryMembership` circuit — Poseidon Merkle tree (depth 5, 27 EU ISO codes) | ✅ Done |
| EU Merkle root anchored as constant in `zkpService.ts` | ✅ Done |
| vKey keccak256 hashes registered in `Deploy.s.sol` → `ZkpVerifierRegistry` | ✅ Done |

## Smart Contracts

Deployed on local Foundry Anvil with deterministic development addresses:

| Contract | Address | Purpose |
|----------|---------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Root of trust, multi-sig governance |
| `AccreditationRegistry.sol` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Hierarchical trust chain (all scopes incl. BusinessRegistry, Enterprise) |
| `CredentialRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | Credential status, issuer accreditation validation |
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

## Authentication

### Admin Client — DID-Auth + RBAC

No passwords. Users authenticate by signing a cryptographic challenge with their Ethereum private key:

1. Client requests a nonce from `POST /api/auth/challenge`
2. Signs the nonce locally with ethers.js (private key never leaves the browser)
3. Submits signature to `POST /api/auth/verify`
4. Backend recovers the signer address, queries on-chain accreditation scope, issues a JWT

The JWT contains the DID's on-chain scope, which drives route guards, sidebar filtering, and backend policies.

### Mobile Wallet — PIN + Biometric

- Secret key generated at wallet creation, stored in iOS Keychain via `expo-secure-store`
- 6-digit PIN hashed with **Argon2id** (`m=64 MiB, t=3, p=1`) in native builds; SHA-256 fallback in Expo Go (`__DEV__`)
- Wrong-PIN lockout: 5 failures → 30 s cooldown; 10 failures → wallet wipe option offered
- Biometric (Face ID / Touch ID) with automatic PIN fallback
- Session idle timeout (5 min) triggers re-auth

## Repository Layout

```
did-wallet-thesis/
├── blockchain/                         # Smart contracts, Foundry scripts, ABIs
│   ├── contracts/
│   │   ├── AccreditationRegistry.sol   # Trust chain (incl. BusinessRegistry + Enterprise)
│   │   ├── CredentialRegistry.sol
│   │   ├── EURootAuthority.sol
│   │   └── ZkpVerifierRegistry.sol     # On-chain vKey anchoring
│   ├── script/Deploy.s.sol             # Deploy + register circuits
│   ├── test/                           # Foundry unit tests (incl. BusinessRegistry branch)
│   ├── abis/                           # Exported ABIs for services
│   └── deployments/latest.json         # Last deployment addresses
├── DID.WalletThesis/
│   └── src/
│       ├── admin-client/               # Angular 21 accreditation platform
│       │   └── src/app/
│       │       ├── core/auth/          # DID-Auth service, scope guard, interceptor
│       │       ├── features/           # member-states, ministries, institutions, enterprises, login
│       │       └── layout/shell/       # Scope-aware sidebar
│       ├── mobile-wallet/              # React Native/Expo mobile app
│       │   └── src/
│       │       ├── screens/            # WelcomeScreen, AccountTypeChooserScreen,
│       │       │                       # RegistrationWizardScreen, UnlockSplashScreen,
│       │       │                       # MainTabNavigator, HomeScreen, CredentialsScreen,
│       │       │                       # ActionsStackNavigator, ActionsStubScreen,
│       │       │                       # PresentationConsentScreen, IncomingPresentationScreen
│       │       ├── components/         # ZkpWebViewBridge (hidden WebView WASM sandbox)
│       │       ├── context/            # RegistrationContext, AuthContext, ThemeContext
│       │       ├── services/           # pinService (Argon2id), euGeoService,
│       │       │                       # zkpService + zkpBridge (WebView ZKP bridge),
│       │       │                       # presentationService (VP history),
│       │       │                       # chainVerifier, credentialIssuer,
│       │       │                       # accreditationLookupService, authService, walletService
│       │       └── types/              # WalletProfile, presentation.ts (request/response schema)
│       │   └── assets/
│       │       ├── eu-geo.json         # 27 EU member states + NUTS-2/3 regions
│       │       └── circuits/           # ageVerification · graduationYearRange · countryMembership
│       │           └── {name}/         #   circuit.wasm · final.zkey · verification_key.json
│       ├── Services/
│       │   ├── DID.Accreditation/      # Accreditation API + DID-Auth + enterprise registrations
│       │   ├── DID.BlockchainSync/     # Event polling + RabbitMQ publisher
│       │   ├── DID.Identity/           # DID generation service
│       │   ├── DID.Credential/         # Credential API
│       │   ├── DID.Presentation/       # Presentation relay (verification runs on-device)
│       │   ├── DID.Notification/       # Notification service
│       │   └── DID.Audit/              # Audit trail
│       ├── Shared/
│       │   ├── DID.Shared.Domain/
│       │   ├── DID.Shared.Application/
│       │   └── DID.Shared.Infrastructure/
│       └── zkp-service/                # Circuit build toolchain only (not a runtime service)
│           ├── src/circuits/           # ageVerification.circom · graduationYearRange.circom · countryMembership.circom
│           ├── scripts/                # setup-circuits.mjs · generate-eu-merkle.mjs
│           ├── circuits_compiled/      # compiled .wasm files
│           └── keys/                   # .zkey · verification_key.json · eu-country-merkle.json
├── docker-compose.infra.yml            # PostgreSQL, RabbitMQ, Foundry Anvil
├── docker-compose.services.yml         # Microservice containers
├── docs/
│   ├── TESTING_GUIDE.md                # Step-by-step testing instructions
│   └── TEST_ACCOUNTS.md                # Anvil test wallet accounts
└── questions_for_hevi.md               # Open questions for thesis author
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

Starts: PostgreSQL, RabbitMQ, Foundry Anvil local chain.

Foundry Anvil stores blockchain state in the `foundry_data` Docker volume — deployed contracts and accreditation data survive restarts.

> **Warning:** `docker compose -f docker-compose.infra.yml down -v` wipes all volumes (Postgres, RabbitMQ, Foundry Anvil).

### 2. Build Smart Contracts

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-builder
```

### 3. Deploy Smart Contracts

Deploy only when starting from a fresh Anvil state:

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer
```

The deployer runs `forge script script/Deploy.s.sol --rpc-url http://foundry:8545 --broadcast`.

Default dev private key (Anvil account #0 — local only, never use in production):
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Expected contract addresses after fresh deployment:

| Contract | Address |
|----------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `AccreditationRegistry.sol` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `CredentialRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| `ZkpVerifierRegistry.sol` | `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9` |

### 4. Export Contract ABIs

```bash
docker compose -f docker-compose.infra.yml --profile tools run --rm abi-exporter
```

### 5. Start Application Services

```bash
docker compose -f docker-compose.services.yml up -d --build
```

Admin client: `http://localhost:4200`

Sign in with one of the Foundry Anvil development private keys listed in [docs/TEST_ACCOUNTS.md](docs/TEST_ACCOUNTS.md).

### 6. Mobile Wallet

```bash
docker compose -f docker-compose.services.yml up -d --build admin-client
npm install
npx expo run:ios
```

> **⚠️ Expo Go is not sufficient** — `react-native-argon2` and snarkjs WASM require a native build (`npx expo run:ios`).

See [docs/USER_TESTING_GUIDE.md](docs/USER_TESTING_GUIDE.md) for full end-to-end testing instructions.

### Daily Development Flow

When Anvil state already exists and contracts are deployed:

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

Non-`0x` output means the contract exists on the local chain.

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| A | Mobile wallet: account types, Argon2id PIN, registration wizard, navigation | ✅ Done |
| B | Smart contracts: BusinessRegistry/Enterprise, ZkpVerifierRegistry, all 3 circuits | ✅ Done |
| C | Admin client + .NET: enterprise approvals, Chamber provisioning, DID.Verification removed | ✅ Done |
| D | Presentation pipeline: on-device ZKP via WebView bridge, Master's / Foreign ID / Job application flows, VP history, unified wallet card stack | ✅ Done |
| E | Polish, demo scripts, SECURITY.md, ARF alignment | ~10% done |

## Technical Details

- **DID method:** `did:ethr` with Secp256k1 keys
- **Credential format:** W3C Verifiable Credentials with JWT proofs
- **ZKP scheme:** Groth16 (via snarkjs / circom)
- **Mobile storage:** SQLite via expo-sqlite + TypeORM, keys in expo-secure-store
- **Event bus:** RabbitMQ + MassTransit
- **Blockchain interaction:** Nethereum (.NET), ethers.js (Angular / Mobile Wallet), Foundry Anvil for local development

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `eth_call` fails | Make sure Foundry Anvil is running: `docker compose -f docker-compose.infra.yml up -d foundry` |
| Contract code returns `0x` | Contracts not deployed. Run `contract-deployer` profile. |
| Chain resets to block `0` after restart | `foundry_data` volume was deleted. Re-deploy contracts. |
| Services cannot reach blockchain | Use `http://foundry:8545` for container-to-container RPC. |
| Browser / mobile cannot reach blockchain | Use `http://localhost:8545` from host. |
| ABI errors in .NET services | Rebuild contracts and run `abi-exporter`. |
| Mobile wallet PIN fails after reinstall | `expo-secure-store` data is tied to the app install — expected behavior; create a new wallet. |

## Standards Alignment

**Implemented:** W3C DID Core 1.0, W3C VC Data Model 1.1, did:ethr Method Specification, EIP-1056.

**Planned / partial:** OpenID4VP, OpenID4VCI, SD-JWT, eIDAS 2.0 / EBSI Trust Framework, EUDI ARF.

## License

Bachelor's thesis project. Academic use.
