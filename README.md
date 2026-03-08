# EU Decentralized Digital Identity System

**Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iași**
Expected Graduation: July 2026

A hierarchical trust-chain DID system aligned with EU eIDAS 2.0, built on Ethereum smart contracts, .NET 10 microservices, a React Native mobile wallet, and a planned Angular admin console for institutional accreditation workflows.

---

## System Overview

The blockchain is the **single source of truth**. Microservices are convenience wrappers — they cache events and expose REST APIs, but they never make authorization decisions. Smart contracts enforce all trust-chain rules on-chain.

```
EU Root Authority (EURootAuthority.sol)
    └── Member State (e.g. RO)
            └── Ministry of Education
                    └── University of Bucharest
                            └── Issues diploma → CredentialRegistry.sol
```

A German employer scans a QR code, the Romanian student submits their diploma with a ZKP (age > 21), and the Verification Service validates the full trust chain directly from the blockchain — all without trusting any individual microservice.

For thesis scope, the primary end-to-end demo focuses on the accreditation and diploma path:
`Member State -> Ministry -> University -> Diploma issuance -> Verification`.
`EURootAuthority.sol` governance remains part of the smart-contract design, but a full voting UI/workflow for new member-state admission is not required for the main application demo.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile Wallet (React Native / Expo / Veramo)                   │
│  • DID management  • VC storage  • QR code scanning            │
│  Angular Admin Console (planned)                                │
│  • Accreditation chain UI  • Diploma issuance demo             │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / SignalR
┌────────────────────────────▼────────────────────────────────────┐
│                     .NET 10 Microservices                       │
│                                                                 │
│  Identity ──── Accreditation ──── Credential ──── Verification  │
│  :5259         :5211               :5214           :5216        │
│                                                                 │
│  Presentation ── ZKP (Node.js) ── Notification ── Audit        │
│  :5217           :3001             :5218            :5219       │
│                                                                 │
│  BlockchainSync (background worker — no HTTP)                   │
└──────┬───────────────────────────────┬───────────────────────────┘
       │ EF Core / Npgsql              │ MassTransit / RabbitMQ
┌──────▼──────┐              ┌─────────▼──────────────────────────┐
│ PostgreSQL  │              │  RabbitMQ (event bus)              │
│ (per-svc DB)│              │  DIDCreated · AccreditationIssued  │
└─────────────┘              │  CredentialIssued · Revoked …      │
                             └──────────────────────────────────┬─┘
                                                                │ Nethereum
                             ┌──────────────────────────────────▼─┐
                             │  Hardhat / Ethereum Node           │
                             │  EURootAuthority.sol               │
                             │  AccreditationRegistry.sol         │
                             │  CredentialRegistry.sol            │
                             └────────────────────────────────────┘
```

---

## Implementation Status

### Phase 0 — Foundation
| # | Component | Status |
|---|-----------|--------|
| 1 | Smart Contracts (Solidity + Hardhat) | ✅ Complete |
| 2 | Shared Libraries (`DID.Shared.*`, `DID.Contracts`) | ✅ Complete |
| 3 | Docker Compose (PostgreSQL, RabbitMQ, Hardhat) | ✅ Complete |

### Phase 1 — Core Services
| # | Service | Status |
|---|---------|--------|
| 4 | BlockchainSync — listens to on-chain events, publishes to RabbitMQ | ✅ Complete |
| 5 | Identity Service — DID generation, key storage, resolution | ✅ Complete |

### Phase 2 — Accreditation & Credentials
| # | Service | Status |
|---|---------|--------|
| 6 | Accreditation Service — off-chain cache of AccreditationRegistry.sol | ✅ Complete |
| 7 | Credential Service — W3C VC issuance against CredentialRegistry.sol | ⏳ Pending |

### Phase 3 — Verification
| # | Service | Status |
|---|---------|--------|
| 8 | Verification Service — 5-step blockchain-first verification | ⏳ Pending |
| 9 | ZKP Service (Node.js) — snarkjs age/graduation proofs | ⏳ Pending |

### Phase 4 — Presentation
| # | Service | Status |
|---|---------|--------|
| 10 | Presentation Service — QR codes, SignalR, session management | ⏳ Pending |
| 11 | Angular Admin Console — accreditation chain and diploma demo UI | ⏳ Planned |

### Phase 5 — Support
| # | Service | Status |
|---|---------|--------|
| 12 | Notification Service — email + push (SendGrid / FCM) | ⏳ Pending |
| 13 | Audit Service — immutable append-only event log | ⏳ Pending |

### Phase 6
| # | Task | Status |
|---|------|--------|
| 14 | Integration & end-to-end testing | ⏳ Pending |

**Overall progress: 6 / 14 tasks (43%)**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, Veramo Framework, TypeScript |
| Blockchain | Solidity 0.8, Hardhat, Nethereum 5.8 |
| Microservices | .NET 10, ASP.NET Core, FastEndpoints v8 |
| Persistence | PostgreSQL 16, EF Core, Npgsql |
| Messaging | RabbitMQ 3.12, MassTransit |
| ZKP | snarkjs, circom |
| Web Admin | Angular (planned) |
| Infrastructure | Docker Compose |

---

## Repository Layout

```
did-wallet-thesis/
├── blockchain/                    # Hardhat project — Solidity contracts + tests
│   ├── contracts/
│   │   ├── EURootAuthority.sol
│   │   ├── AccreditationRegistry.sol
│   │   └── CredentialRegistry.sol
│   ├── scripts/deploy.ts
│   └── test/
│
├── DID.WalletThesis/              # .NET solution
│   └── src/
│       ├── Shared/
│       │   ├── DID.Contracts/             # RabbitMQ event DTOs
│       │   ├── DID.Shared.Domain/         # Entity, ValueObject, AggregateRoot
│       │   ├── DID.Shared.Application/    # IBlockchainService, IEventBus, IRepository
│       │   └── DID.Shared.Infrastructure/ # Nethereum, MassTransit, EF Core impls
│       └── Services/
│           ├── DID.BlockchainSync/        # ✅ Background worker
│           ├── DID.Identity/              # ✅ port 5259
│           ├── DID.Accreditation/         # ✅ port 5211
│           ├── DID.Credential/            # ⏳ port 5214
│           ├── DID.Verification/          # ⏳ port 5216
│           ├── DID.Presentation/          # ⏳ port 5217
│           ├── DID.Notification/          # ⏳ port 5218
│           └── DID.Audit/                 # ⏳ port 5219
│
├── mobile-wallet/                 # React Native / Expo app
├── admin-client/                  # ⏳ Planned Angular admin/demo console
├── zkp-service/                   # ⏳ Node.js snarkjs service (port 3001)
├── docker-compose.yml
├── TASKS.md                       # Detailed task breakdown
├── IMPLEMENTATION_PLAN.md         # Architecture decisions
└── DID.WalletThesis/DEMO.md       # End-to-end demo walkthrough
```

---

## Quick Start

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | Latest | Runs PostgreSQL, RabbitMQ, Hardhat node |
| .NET 10 SDK | 10.0+ | Microservices |
| Node.js | 20+ | Blockchain scripts, mobile wallet |
| Xcode | 16+ | iOS simulator (macOS only) |
| Expo CLI | Latest | `npm install -g expo-cli` |

### 1. Start infrastructure

```bash
docker compose up -d
```

Create service databases (one-time):

```bash
docker exec -it did-postgres psql -U did_user -d did_wallet -c "
  CREATE DATABASE did_identity;
  CREATE DATABASE did_accreditation;
  CREATE DATABASE did_blockchainsync;
"
```

### 2. Deploy smart contracts

```bash
cd blockchain
npm install
npx hardhat run scripts/deploy.ts --network localhost
```

Contract addresses are deterministic and already configured in `appsettings.json`.

### 3. Run services

```bash
cd DID.WalletThesis

# Terminal 1 — background event sync (no HTTP port)
dotnet run --project src/Services/DID.BlockchainSync

# Terminal 2
dotnet run --project src/Services/DID.Identity

# Terminal 3
dotnet run --project src/Services/DID.Accreditation
```

Migrations apply automatically on startup.

| Service | URL | Swagger |
|---------|-----|---------|
| Identity | http://localhost:5259 | http://localhost:5259/swagger |
| Accreditation | http://localhost:5211 | http://localhost:5211/swagger |

### 4. Run mobile wallet

```bash
cd mobile-wallet
npm install
npx expo start --ios
```

Press `i` to open the iOS simulator, or scan the QR code with the Expo Go app on a physical device.

See [DID.WalletThesis/DEMO.md](DID.WalletThesis/DEMO.md) for a full blockchain-to-API walkthrough.

The Angular admin console is planned after the Credential Service is stable. It will provide a browser-based demo flow for accreditation hierarchy management and later diploma issuance.

---

## API Reference (Implemented Services)

### Identity Service — `POST /api/dids`

```json
{ "controllerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" }
```

Returns a W3C DID Document with `did:ethr:sepolia:{address}` format and secp256k1 keys.

Other endpoints: `GET /api/dids/{did}`, `GET /api/dids/{did}/keys`

### Accreditation Service

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/accreditations` | Issue on-chain accreditation (used for demo/admin flows) |
| GET | `/api/accreditations` | List (filter by `issuerDid` / `subjectDid`) |
| GET | `/api/accreditations/{id}` | Resolve |
| GET | `/api/accreditations/{id}/verify` | Verify blockchain-backed status and trust-chain validity |
| DELETE | `/api/accreditations/{id}` | Revoke on-chain |

---

## Standards & Compliance

| Standard | Status |
|----------|--------|
| W3C DID Core 1.0 | Implemented |
| W3C Verifiable Credentials 1.1 | Implemented (mobile wallet) |
| eIDAS 2.0 trust hierarchy | Implemented (smart contracts) |
| OpenID4VP / OpenID4VCI | Planned (Presentation Service) |
| SD-JWT | Planned |

---

## Key Design Decisions

- **Blockchain is the source of truth.** Smart contracts always validate authorization on-chain; microservices never act as gatekeepers.
- **Clean Architecture per service.** Domain → Application → Infrastructure → Endpoints, no cross-layer shortcuts.
- **Event-driven sync.** BlockchainSync polls the chain, writes to PostgreSQL, and publishes to RabbitMQ. Other services consume events to maintain off-chain caches.
- **FastEndpoints** over MVC controllers — minimal overhead, request/response classes, vertical slice per endpoint.
- **Thesis demo scope is deliberately narrow.** Full EU governance voting is kept at contract/design level; the implemented application demo focuses on accreditation hierarchy and diploma issuance.
- **Separate operator and holder UX.** The mobile wallet remains holder-facing, while the planned Angular admin console will handle institutional accreditation and issuance workflows.

---

## License

Academic research project — for educational purposes.

**Alexandru Ioan Cuza University, Iași — Faculty of Computer Science**
