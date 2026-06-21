# EU Decentralised Digital Identity System

Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iași

A blockchain-anchored, privacy-preserving digital identity prototype implementing hierarchical trust chains, DID-based authentication, W3C Verifiable Credentials, and zero-knowledge proofs across a mobile wallet, an institutional accreditation platform, and a set of Ethereum smart contracts.

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
                   Source of truth for trust,
                   authorisation, and ZKP vKey anchoring
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
  ┌──────────▼──────────┐ ┌─────────▼──────────────────────────────────┐
  │ Accreditation        │ │ Mobile Wallet                              │
  │ Platform             │ │                                            │
  │                      │ │ React Native/Expo · Veramo · SQLite        │
  │ Angular 21 + .NET 10 │ │ expo-secure-store · snarkjs via WebView    │
  │ DID-Auth + RBAC      │ │ Keys generated on-device, never leave      │
  └──────────────────────┘ │ Groth16 ZKP proofs generated on-device     │
                           └────────────────────────────────────────────┘

  zkp-service/  (build-time only — not a runtime service)
  circom 2.x + snarkjs trusted setup → .wasm / .zkey / vKey assets bundled into the mobile wallet
```

The blockchain is the authoritative source of trust. Backend microservices are index and relay wrappers: they cache on-chain state for efficient querying and handle business workflows, but they never hold or act on a user's private key. All writes to the chain are signed by the operator's in-browser wallet or the holder's on-device wallet; the backend records the resulting confirmed transaction.

### Trust Hierarchy

```
EU Root Authority (EURootAuthority.sol)
  └── Member State (AccreditationRegistry.sol)
        ├── Ministry
        │     └── Institution
        └── Business Registry
              └── Enterprise
```

Every level is enforced by smart contract logic. A node in the hierarchy can only issue accreditations at or below its own scope, and `validateTrustChain` verifies the entire chain up to the EU Root on demand.

---

## Platforms

### Accreditation Platform

Institutional control plane used by EU Root operators, member states, ministries, universities, and business registries to issue and manage accreditations, and by verifiers to review incoming presentations.

**Stack:** Angular 21, Tailwind CSS, .NET 10 (FastEndpoints), Nethereum, PostgreSQL, RabbitMQ + MassTransit.

- DID-Auth login — operators sign a challenge nonce with their Ethereum private key; no passwords
- Role-based access control derived from on-chain accreditation scope
- Hierarchical accreditation issuance and revocation, all signed client-side via ethers.js
- Trust chain verification via `validateTrustChain()` on-chain
- Enterprise registration review and approval queue
- In-browser ZKP proof verification via `snarkjs.groth16.verify()` using bundled verification keys

### Mobile Wallet

Citizen-controlled holder application. All keys and credential data remain on-device.

**Stack:** React Native, Expo, Veramo Framework, SQLite (TypeORM), expo-secure-store, ethers.js.

- `Secp256k1` keypair generated on-device at wallet creation; private key stored in iOS Keychain via `expo-secure-store`
- DID management (`did:ethr:sepolia`) — wallet signs its own blockchain transactions
- W3C Verifiable Credential storage and display (unified card stack)
- Three account types: Personal, University, Enterprise
- 6-digit PIN hashed with Argon2id (`m=64 MiB, t=3, p=1`); biometric unlock (Face ID / Touch ID)
- Wrong-PIN lockout: 5 failures → 30 s cooldown; 10 failures → wallet wipe
- On-device ZKP proving via hidden WKWebView bridge (snarkjs + WASM, Hermes-compatible)
- Three ZKP circuits: `ageVerification`, `graduationYearRange`, `countryMembership`
- Presentation request flow via `eudi-pres://` URI scheme and QR encoding
- On-device ZKP and trust-chain verification on the verifier's side

### ZKP Circuit Toolchain

Build-time tooling only — not a runtime service. Compiles circom circuits and runs the trusted setup ceremony. Output artifacts are bundled into the mobile wallet and the accreditation platform.

| Circuit | Description |
|---------|-------------|
| `ageVerification` | Proves age ≥ threshold without revealing date of birth |
| `graduationYearRange` | Proves graduation year falls within a range |
| `countryMembership` | Proves EU membership via Poseidon Merkle inclusion (depth 5, 27 ISO codes) |

Each circuit produces `.wasm`, `.zkey`, and `verification_key.json`. The verification key keccak256 hashes are registered on-chain in `ZkpVerifierRegistry` at deploy time.

---

## Smart Contracts

Deployed on local Foundry Anvil (chain ID 31337):

| Contract | Address | Purpose |
|----------|---------|---------|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Root of trust |
| `AccreditationRegistry.sol` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Hierarchical trust chain management |
| `CredentialRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | Credential status and issuer validation |
| `ZkpVerifierRegistry.sol` | `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9` | On-chain vKey hash anchoring |

### Accreditation Scopes

```
0 = None
1 = MemberState
2 = Ministry
3 = Institution
4 = Department
5 = BusinessRegistry
6 = Enterprise
```

---

## Backend Services

| Service | Responsibility |
|---------|---------------|
| `DID.Accreditation` | Accreditation lifecycle, DID-Auth, enterprise registration, RBAC |
| `DID.Credential` | Credential issuance relay, revocation, on-chain status queries |
| `DID.Identity` | DID registry index — maps DIDs to controller addresses and display metadata |
| `DID.BlockchainSync` | Polls on-chain events, keeps off-chain indexes current via RabbitMQ |

All services share `DID.Shared` (domain primitives, `IBlockchainService` facade, `BlockchainAddressUtils`).

---

## Repository Layout

```
did-wallet-thesis/
├── blockchain/
│   ├── contracts/                  # Solidity contracts
│   ├── script/Deploy.s.sol         # Deploy + register ZKP vKey hashes
│   ├── test/                       # Foundry unit tests
│   ├── abis/                       # Exported ABIs consumed by .NET services
│   └── deployments/latest.json
├── DID.WalletThesis/src/
│   ├── admin-client/               # Angular 21 accreditation platform
│   ├── mobile-wallet/              # React Native / Expo wallet
│   │   └── assets/circuits/        # Compiled ZKP artifacts per circuit
│   ├── Services/
│   │   ├── DID.Accreditation/
│   │   ├── DID.BlockchainSync/
│   │   ├── DID.Credential/
│   │   └── DID.Identity/
│   ├── Shared/
│   │   ├── DID.Shared.Domain/
│   │   ├── DID.Shared.Application/
│   │   └── DID.Shared.Infrastructure/
│   └── zkp-service/                # Circuit build toolchain (build-time only)
├── chapters/                       # Thesis chapter drafts
├── audits/                         # Security audit reports
├── docker-compose.infra.yml        # PostgreSQL, RabbitMQ, Foundry Anvil
├── docker-compose.services.yml     # Microservice containers
└── docs/
    ├── TESTING_GUIDE.md
    └── TEST_ACCOUNTS.md
```

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

Bachelor's thesis project. Academic use.
