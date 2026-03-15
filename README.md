# EU Digital Identity Research Prototype

Bachelor's Thesis — Computer Science, Alexandru Ioan Cuza University, Iasi

This repository is being reshaped into a blockchain-anchored, privacy-preserving digital identity prototype with 3 main platforms:

1. Accreditation Platform
2. Mobile Wallet App
3. Verifier Platform

The goal is not to reproduce the full future EUDI ecosystem. The goal is to build and evaluate a focused prototype that:

- enforces institutional trust and credential status on-chain
- keeps keys under wallet control
- uses zero-knowledge proofs as a mandatory privacy mechanism
- aligns wallet-facing flows with EUDI-style issuance and presentation standards
- uses off-chain services only as helpers for UX, communication, indexing, or proof execution

## System Vision

### 1. Accreditation Platform

The accreditation platform is the institutional control plane.

It is used by:

- EU root demo authority
- member states
- ministries
- institutions

It manages a hierarchical trust model:

```text
EU Root
  -> Member State
      -> Ministry
          -> Institution
              -> Credential issuance authority
```

What it must do:

- register the demo member states used in the thesis scenario
- issue scoped accreditations on-chain
- revoke and inspect accreditations
- show trust-chain hierarchy, status, expiry, and transaction references
- act as an issuer/admin operator UI, not as the source of trust

### 2. Mobile Wallet App

The wallet is the citizen-controlled component.

What it must do:

- hold keys locally
- receive and store credentials
- create privacy-preserving presentations
- generate mandatory ZKP-backed proofs
- share proofs through QR or time-limited request flows
- avoid disclosing unnecessary personal data

### 3. Verifier Platform

The verifier platform is the relying-party UI for banks, employers, and academic institutions.

What it must do:

- request a presentation for a specific purpose
- validate credential signatures and proof artifacts
- validate credential status on-chain
- validate issuer trust through the accreditation chain
- return an eligibility decision without unnecessary data exposure

## Trust Model

The blockchain is the trust anchor.

Smart contracts are responsible for:

- trust hierarchy
- issuer authorization
- credential status
- revocation and suspension
- trust-chain validation
- event emission

Wallets and clients are responsible for:

- key custody
- DID and credential ownership
- transaction signing
- presentation creation
- proof generation or proof-orchestration
- direct verification reads when correctness matters

Helper services are allowed only for:

- indexing
- relaying
- presentation brokering
- notification
- proof execution assistance

Helper services are not allowed to be:

- key custodians
- trust authorities
- authorization gates
- the only source of verification truth

## EUDI Alignment

This project is a research prototype aligned with the direction of the EUDI ecosystem, not a full EUDI implementation.

Target alignment:

- OpenID4VCI for issuance interactions
- OpenID4VP for presentation interactions
- EUDI-compatible credential/presentation modeling
- minimal disclosure
- holder-controlled consent
- mandatory privacy-preserving proof flow

Important constraint:

- blockchain is the internal trust and status infrastructure
- EUDI-style issuance and presentation protocols are the interoperability layer exposed to wallets and verifiers

## Current Direction

The previous repository direction emphasized many domain microservices. The new direction is:

- keep the smart contracts as the center of trust
- keep or refactor the admin client into the accreditation platform
- refactor the mobile wallet into a real holder wallet
- add a verifier-facing platform
- downgrade most backend services into optional helpers
- extract reusable client-side chain and verification logic into a shared SDK

## Repository Layout

```text
did-wallet-thesis/
├── blockchain/                    # authoritative on-chain trust logic
├── DID.WalletThesis/
│   └── src/
│       ├── admin-client/          # accreditation platform UI
│       ├── Services/              # current helper/backend services, to be reduced in authority
│       └── Shared/
├── mobile-wallet/                 # holder wallet
├── zkp-service/                   # proof-generation / verification helper
├── IMPLEMENTATION_PLAN.md         # architecture and migration strategy
├── TASKS.md                       # execution backlog and weekly plan
└── PROJECT_ANALYSIS_v2.md         # code-based assessment and feasibility analysis
```

## Current Status Snapshot

Implemented foundations:

- Solidity contracts for root authority, accreditations, and credential status
- Hardhat project with tests and deployment scripts
- Angular admin client scaffold with accreditation-oriented UI direction
- React Native wallet scaffold with Veramo-based DID/VC groundwork
- ZKP service with proof generation and verification
- .NET services that currently expose blockchain-backed APIs, but must be demoted from trust authorities to helper roles over time

Main architectural gaps still to close:

- contract / service mismatch in the credential flow
- incomplete EUDI-compatible issuance and presentation flows
- mobile wallet not yet aligned with the final identity and privacy model
- verifier platform not yet implemented as a coherent product
- backend still too authoritative in several places

## This Week's Goal

The immediate milestone is not the whole thesis platform. It is a finished accreditation-platform vertical slice plus mobile-wallet refactoring groundwork.

By the end of this week, the target is:

- a presentable accreditation platform demo
- stable on-chain issuance, listing, revocation, and verification for accreditations
- trust-chain visualization in the admin UI
- a refactored mobile-wallet foundation prepared for real holder credentials and ZKP-backed presentations

## Week-by-Week Roadmap

### Week 1 — March 9 to March 15

Focus:

- finish the accreditation platform
- refactor the mobile wallet foundation

Expected deliverables:

- admin UI for actor selection, accreditation issuance, list, detail, revoke, and verify
- stable accreditation service and contract path for the demo
- trust-chain display in the UI
- mobile-wallet refactor plan started or partially executed
- wallet code cleaned up around DID, credential, and storage boundaries

### Week 2 — March 16 to March 22

Focus:

- stabilize credential path and remove contract/service drift
- define the final identity model and credential format strategy

Expected deliverables:

- credential contract/API compatibility fixed
- final DID / identifier strategy documented
- shared client SDK structure started
- mobile wallet ready to receive real thesis credentials instead of demo-only self-issued ones

### Week 3 — March 23 to March 29

Focus:

- wallet-first credential issuance flow
- start EUDI-aligned issuance orchestration

Expected deliverables:

- institution-side issuance flow clarified
- wallet receives and stores thesis credentials
- shared SDK handles contract reads and normalization
- OpenID4VCI-aligned flow design documented or partially implemented

### Week 4 — March 30 to April 5

Focus:

- verifier platform foundation
- presentation request and response flow

Expected deliverables:

- verifier UI scaffold
- verifier request model
- QR or challenge-based flow between verifier and wallet
- initial on-chain verification path for credentials and issuer trust

### Week 5 — April 6 to April 12

Focus:

- mandatory ZKP integration in the holder-to-verifier flow

Expected deliverables:

- wallet prepares ZKP-backed disclosure
- verifier validates proof and on-chain status together
- at least one real scenario works end to end

### Week 6 — April 13 to April 19

Focus:

- end-to-end scenario hardening
- reduce backend authority

Expected deliverables:

- services re-scoped as indexer, broker, relay, or helper only
- clearer trust boundaries in code and docs
- demo path works with minimal backend trust assumptions

### Week 7 — April 20 to April 26

Focus:

- thesis demo polishing
- documentation and architecture hardening

Expected deliverables:

- stable 3-platform narrative
- polished accreditation platform
- stable wallet flow
- stable verifier flow
- updated diagrams, README, plan, and thesis notes

### Week 8 — April 27 to May 3

Focus:

- buffer, bug fixing, presentation preparation

Expected deliverables:

- rehearsable demo
- stable screenshots and architecture explanation
- explicit limitations and future-work framing

## What “Done” Means for the Thesis

The thesis is in a good state if these are true:

1. Accreditation hierarchy works and is demonstrable.
2. Wallet stores and presents real thesis credentials.
3. Verifier checks trust and eligibility without depending on a trusted backend answer.
4. ZKP is part of the live privacy story, not a side experiment.
5. EUDI alignment is visible in the issuance and presentation design.
6. Off-chain services are helpers, not trust anchors.

## Where to Look Next

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the target architecture and migration strategy
- [TASKS.md](TASKS.md) for the execution backlog and weekly breakdown
- [PROJECT_ANALYSIS_v2.md](PROJECT_ANALYSIS_v2.md) for the feasibility and risk analysis