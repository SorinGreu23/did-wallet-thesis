# Implementation Plan: Decentralized-First DID System

## Executive Summary

This plan replaces the previous service-centric architecture with a decentralized-first architecture.

Target outcome:

- Smart contracts remain the only trust anchor and authorization layer.
- Wallets hold keys and sign transactions or presentations directly.
- Clients read blockchain state directly when correctness matters.
- Helper services exist only for communication, indexing, relaying, notification, and UX acceleration.
- No helper service is allowed to be a source of truth, a key custodian, or an authorization gatekeeper.

This is the architectural position the thesis should aim to defend:

> The blockchain enforces institutional trust and credential status.
> Wallets control identities and credentials.
> Off-chain services only improve usability, interoperability, and performance.

This also fits the thesis scope better than the current 9-microservice plan.

- Full member-state voting for EU adherence remains outside application scope.
- Root governance may remain part of the contract design and contract tests.
- The thesis delivery focus is the vertical slice:
  `Member State -> Ministry -> Institution -> Credential issuance -> Holder wallet -> Verifier check -> ZKP-backed presentation`
- The wallet-facing and verifier-facing flows must align with EUDI standards, especially OpenID4VCI, OpenID4VP, and EUDI-compatible credential and presentation formats.

---

## 1. Core Design Principles

### 1.1 Non-negotiable principles

1. Smart contracts make authorization decisions.
2. Wallets hold private keys.
3. Credentials are issued by issuer wallets, not by backend-owned service keys.
4. Verification reads from blockchain or from cryptographically verifiable artifacts.
5. Helper services may cache, relay, notify, or index, but they may never override on-chain truth.
6. Every helper service must be optional from a trust perspective.
7. Zero-knowledge proof support is mandatory in the holder-to-verifier flow, not an optional enhancement.
8. Wallet-facing issuance and presentation flows must align with EUDI standards rather than ad hoc custom APIs.

### 1.2 What must no longer happen

The decentralized target architecture explicitly avoids these patterns:

- backend-generated DIDs as the primary identity model
- backend custody of issuer or holder private keys
- backend authorization decisions based on local databases
- backend-only verification results treated as authoritative
- service-to-service trust chains that are not independently reproducible from on-chain state
- wallet flows that are disconnected from the same DID and credential model used by contracts

### 1.3 Honest decentralization boundary

The system can still use helper infrastructure without breaking decentralization, as long as the following is true:

- if an indexer goes down, verification is slower but still possible
- if a relay goes down, users can still submit transactions directly
- if a notification service goes down, credentials still work
- if a presentation broker goes down, wallets can still exchange signed requests and responses by another channel

That is the correct decentralization test.

---

## 2. Target Architecture

## 2.1 High-level architecture

```text
Issuer Wallet / Admin Wallet          Holder Wallet                   Verifier App / Wallet
- holds issuer keys                   - holds holder keys             - creates verification requests
- issues accreditations               - stores credentials            - validates proofs and status
- issues credentials                  - creates presentations         - reads blockchain directly
          \                                 |                                 /
           \                                |                                /
            \                               |                               /
             ---------------- Ethereum / EVM Blockchain -------------------
                              - EURootAuthority
                              - AccreditationRegistry
                              - CredentialRegistry

Optional helper layer (non-authoritative):
- Indexer / Event mirror
- Relay / gas sponsor
- Presentation broker
- Notification service
- ZKP proving helper or verifier helper
```

## 2.2 Responsibility split

### On-chain

Smart contracts are responsible for:

- trust hierarchy
- issuer authorization
- credential status
- revocation / suspension
- accreditation-chain validation
- immutable event emission

### Wallets / clients

Clients are responsible for:

- key generation and storage
- DID ownership
- transaction signing
- VC creation and storage
- presentation creation
- proof submission
- direct verification reads when high assurance is required

### Helper services

Helper services are responsible only for:

- indexing events for fast UI queries
- relaying transactions if gas abstraction is needed
- brokering presentation sessions between verifier and holder
- sending notifications
- generating ZK proofs when client-side proving is too heavy

They are not responsible for:

- issuing identities as an authority
- deciding who is accredited
- deciding whether a credential is valid
- owning private keys for institutional actors
- acting as the mandatory path for verification

---

## 3. Identity Model

## 3.0 EUDI alignment requirements

If the project must align with EUDI standards, the blockchain layer cannot be the only thing that defines interoperability.

The plan must therefore separate two concerns:

- blockchain as internal trust and status infrastructure
- EUDI-compatible issuance and presentation protocols as the external interoperability layer

Required EUDI alignment targets for the thesis architecture:

- OpenID4VCI for credential issuance interactions
- OpenID4VP for presentation and verifier request flows
- EUDI-compatible credential formats, with priority given to SD-JWT VC and/or ISO mdoc where appropriate for the selected use case
- wallet-controlled keys and holder-controlled presentations
- minimal disclosure, with ZKP or selective-disclosure mechanisms built into the demonstration path

Practical implication:

- the blockchain should anchor accreditation and credential status
- the wallet should speak EUDI-style issuance and presentation protocols
- helper services may assist protocol exchange, but they should not become the trust anchor

## 3.1 Required identity strategy

The current project mixes `did:ethr:sepolia`, `did:key`, and `did:web` without clear boundaries. The revised plan must make this explicit.

Recommended model:

- Institutional actors: expose EUDI-compatible identifiers and metadata to external parties; if DIDs are used, prefer methods that are easier to align with public trust infrastructure and interoperability, such as `did:web` or another explicitly supported method for your chosen wallet flow.
- Holder wallets: use the identifier model most compatible with the selected EUDI issuance/presentation flow; do not leave this as an open-ended mix in the final thesis design.
- Blockchain addresses remain internal authorization anchors for smart contracts, but they should not be the only interoperability surface exposed to wallets and verifiers.

### Recommended thesis choice

For maximum coherence with both the current contracts and EUDI-style interoperability, use a dual-layer identity model:

- smart-contract authorization keyed by blockchain addresses
- wallet and verifier interoperability keyed by EUDI-compatible credential exchange identifiers and metadata
- public institutional metadata exposed in a standards-friendly form rather than only as `did:ethr`

If holders use `did:key` or another non-address DID method, the plan must explicitly define how that identifier is bound to an on-chain holder address for credential status lookup and presentation.

If simplicity is the priority for the demo, you may still use address-based blockchain identifiers internally, but the issuance and presentation layer should still be modeled around EUDI-compatible flows rather than raw custom REST endpoints.

## 3.2 Remove Identity Service as an authority

The current Identity Service should not remain a source of truth for DID creation.

Replace it with one of these roles:

- a thin DID helper API that formats DID Documents from public blockchain data only
- a client SDK module inside the wallet and admin app
- an optional resolver cache, never authoritative

New rule:

- DIDs are created by wallets or admin clients locally.
- The backend does not mint identities for users.
- The backend may expose convenience resolution, but resolution must be derivable without trusting it.

---

## 4. Credential and Accreditation Model

## 4.1 Accreditation issuance

Target model:

- institutional admin wallet signs and submits accreditation transactions directly to the blockchain
- the smart contract validates whether the issuer is allowed to issue that accreditation
- UI clients may optionally use a relay helper if direct transaction submission is inconvenient

This replaces the current model where an API service performs issuance using configured keys or request-supplied private keys.

## 4.2 Credential issuance

Target model:

- issuer wallet creates the VC payload locally
- issuer wallet signs the VC locally
- issuer wallet submits the credential-status anchor to the blockchain directly
- holder receives the signed VC directly or via a presentation/issuance helper channel

The credential service should no longer be a credential issuer in the trust sense.

It may remain only as:

- an OpenID4VCI helper
- a transaction relay
- a VC delivery broker
- an indexing/query helper

## 4.3 Verification

Target model:

- verifier obtains VC or VP from holder
- verifier validates cryptographic signature locally
- verifier checks credential status on-chain directly
- verifier checks issuer accreditation chain on-chain directly
- verifier validates the mandatory ZKP locally or with a helper verifier service

The verification helper service, if kept, must be non-authoritative.

New rule:

- any verification result returned by a backend must be reproducible independently by the verifier from the same VC, proof, and blockchain state

---

## 5. Helper Services That Still Make Sense

A fully decentralized architecture does not mean "no services at all". It means services stop being trust anchors.

## 5.1 Indexer Service

Keep a helper equivalent of `BlockchainSync`, but redefine it as an indexer rather than as infrastructure all other services depend on.

Responsibilities:

- subscribe to contract events
- store searchable event history
- expose query APIs for UI convenience
- speed up dashboards and filtering

Non-responsibilities:

- no authorization decisions
- no issuance rights
- no canonical verification results

Suggested name:

- `Indexer`
- `EventMirror`
- `ChainIndexer`

## 5.2 Relay Service

Introduce a dedicated relay helper only if needed.

Responsibilities:

- forward signed payloads or sponsor gas
- optionally support meta-transactions if added later
- improve mobile UX for users with limited native chain interaction

Constraints:

- relay never signs on behalf of users
- relay never modifies payload semantics
- users can bypass relay and submit directly

## 5.3 Presentation Broker

Keep a lightweight presentation service only for communication.

Responsibilities:

- create session IDs or challenge tokens
- deliver presentation requests
- coordinate QR-based exchange
- support WebSocket or SignalR communication

Constraints:

- broker never decides validity
- broker never owns holder credentials
- broker never rewrites proofs or presentations

## 5.4 Notification Service

Optional and purely operational.

Responsibilities:

- email or push alerts for issuance / revocation / requests

Constraints:

- notification failure does not affect trust or validity

## 5.5 ZKP Proving and Verification Helper

ZKP is a mandatory part of the architecture and the end-to-end demo.

The only open question is where proof generation happens:

- on-device in the wallet, if performance is acceptable
- in a helper service, if proving is too heavy for the device class used in the demo

Responsibilities:

- generate proofs from client-provided witness data
- verify proofs when verifier-side offloading is needed
- return proof artifacts

Constraints:

- verifier still validates proof independently
- service must not be treated as proof authority
- the demo path must include proof generation and proof validation even if helper infrastructure is used
- helper-based proving must be presented as a performance compromise, not as a trust dependency

---

## 6. What to Decommission or Downgrade

## 6.1 Services to remove as authorities

The following current services should no longer be treated as core domain authorities:

- Identity Service
- Accreditation Service
- Credential Service
- Verification Service

## 6.2 Their replacement role

These may survive only as optional helper APIs:

- `Identity` -> resolver/cache/helper SDK or removed entirely
- `Accreditation` -> indexer-backed query API only
- `Credential` -> issuance delivery / OpenID helper / indexer-backed query API only
- `Verification` -> reproducible helper API only, or removed in favor of client-side verification library

## 6.3 New preferred structure

```text
did-wallet-thesis/
├── blockchain/                 # authoritative trust logic
├── client-sdk/                 # shared chain + VC + DID logic for apps
├── mobile-wallet/              # holder wallet
├── admin-client/               # issuer / admin wallet UI
├── verifier-client/            # verifier UI or module
├── helper-services/
│   ├── indexer/
│   ├── relay/
│   ├── presentation-broker/
│   ├── notifications/
│   └── zkp-helper/
└── docs/
```

The key architectural change is this:

- move trust logic into contracts and shared client libraries
- move key ownership into wallets
- shrink services to optional infrastructure

---

## 7. Shared Client SDK

A decentralized system needs a shared client SDK more than it needs many microservices.

## 7.1 Create a shared client SDK

Add a shared TypeScript SDK used by:

- mobile wallet
- admin client
- verifier client

SDK responsibilities:

- contract bindings and reads
- transaction preparation
- DID normalization
- credential-status lookup
- trust-chain verification
- event decoding
- VC creation / parsing helpers
- presentation request / response models
- OpenID4VCI / OpenID4VP flow helpers
- EUDI-compatible credential-format helpers
- ZKP proof request and verification helpers

This SDK becomes the real integration layer of the system.

## 7.2 Why this matters

Right now, too much chain logic is duplicated or hidden inside backend services. In a decentralized architecture, the reusable logic should live in a client-consumable SDK, not in server-only application services.

---

## 8. Revised User Flows

## 8.1 Accreditation issuance flow

1. Admin opens issuer UI.
2. UI reads current hierarchy from blockchain or indexer.
3. Admin wallet signs and submits accreditation transaction directly.
4. Smart contract validates issuer rights.
5. Indexer mirrors resulting event for fast UI updates.

## 8.2 Credential issuance flow

1. Institution UI prepares VC payload.
2. Institution wallet signs VC locally.
3. Institution wallet anchors credential status on-chain directly.
4. Holder wallet receives the VC directly, by QR, or by issuance helper.
5. Holder stores VC locally.

## 8.3 Verification flow

1. Verifier creates request or challenge.
2. Holder wallet prepares VP and mandatory ZKP-backed disclosure.
3. Holder sends presentation directly or via broker.
4. Verifier validates VC signature locally.
5. Verifier reads credential status from blockchain.
6. Verifier reads issuer accreditation chain from blockchain.
7. Verifier validates the ZKP locally or using a helper verifier.
8. Final trust decision is made by verifier logic, not by a backend database.

---

## 9. Revised Smart Contract Priorities

The contracts become even more important in the new plan.

## 9.1 Required contract responsibilities

Contracts must be the only place that decides:

- who can issue which accreditation
- whether an issuer is currently trusted
- whether a credential is active / revoked / suspended
- how trust-chain validity is computed

## 9.2 Contract improvements required

Before the decentralized-first architecture can work cleanly, the contract layer should be tightened.

Required improvements:

1. Fix the contract / ABI / service drift first.
2. Make the accreditation hierarchy logic match the intended issuance model.
3. Tighten root bootstrap logic so the trust anchor is defensible.
4. Clarify revocation rights in contract logic.
5. Decide whether holder binding is address-based, DID-based, or both.
6. Emit clean events that support light clients and indexers.

## 9.3 Scope note on governance

Full member-state adherence voting is not part of the application delivery scope.

For the thesis demo, the root contract only needs to be good enough to:

- explain the trust anchor
- bootstrap local scenarios honestly
- avoid making claims the implementation does not support

That means the real delivery priority is still:

- accreditation correctness
- credential issuance correctness
- verification correctness
- holder/verifier privacy flow with mandatory ZKP support

---

## 10. Revised Client Priorities

## 10.1 Mobile wallet

The mobile wallet becomes a first-class system component, not just a UI demo.

Required capabilities:

- local key custody
- DID creation aligned with the chosen DID model
- VC storage
- direct chain status lookup
- presentation creation
- mandatory ZKP generation or helper-service integration
- OpenID4VCI and OpenID4VP-compatible flow support
- QR-based or deep-link-based exchange

## 10.2 Admin / issuer client

The Angular admin app should evolve into an issuer wallet UI.

Required capabilities:

- connect issuer wallet
- browse trust chain
- issue accreditations directly
- issue credentials directly
- support EUDI-aligned issuance flow orchestration
- inspect transaction hashes and on-chain results
- avoid server-side signing

## 10.3 Verifier client

Add a lightweight verifier-facing client or module.

Required capabilities:

- create verification requests
- receive presentations
- support OpenID4VP-style verifier interactions
- validate VC signatures
- read contract state directly
- validate ZK proofs
- render explanation of verification result

---

## 11. Revised Helper-Service Rules

Every helper service must satisfy all of these rules:

1. It can go down without invalidating credentials.
2. It never holds long-term user private keys.
3. It never makes the only copy of required trust data.
4. It never returns unverifiable "trust me" answers.
5. Its outputs can be independently checked by a client.

If a planned service does not satisfy those rules, it should not exist in the decentralized architecture.

---

## 12. Delivery Phases

## 12.0 Week-by-week roadmap

### Week 1 — March 9 to March 15

Primary focus:

- finish the accreditation platform
- refactor the mobile wallet foundation

Planned deliverables:

- operator/admin flow for issuing accreditations
- accreditation list, detail, revoke, and verify screens
- trust-chain visualization for the accreditation hierarchy
- stable blockchain-backed accreditation demo
- wallet refactor around identity, credential, storage, and proof boundaries

Non-goals for this week:

- full verifier platform
- full EUDI protocol implementation
- full credential flow
- governance UI

### Week 2 — March 16 to March 22

Primary focus:

- fix the credential architecture drift
- finalize identity and credential-format decisions

Planned deliverables:

- credential path compatibility fixed
- EUDI-aligned identifier and credential-format strategy documented
- shared SDK extraction started

### Week 3 — March 23 to March 29

Primary focus:

- wallet-first credential issuance
- holder-wallet integration with real thesis credentials

Planned deliverables:

- issuer-side signing flow clarified
- wallet stores real thesis credentials
- status and trust checks move into shared client logic

### Week 4 — March 30 to April 5

Primary focus:

- verifier platform foundation
- presentation-request flow

Planned deliverables:

- verifier UI/module scaffold
- QR or challenge-based request flow
- first end-to-end verification skeleton

### Week 5 — April 6 to April 12

Primary focus:

- mandatory ZKP-backed presentation flow

Planned deliverables:

- wallet-side proof generation for one real scenario
- verifier-side proof validation combined with trust-chain validation

### Week 6 — April 13 to April 19

Primary focus:

- reduce backend authority
- clarify helper-service roles

Planned deliverables:

- indexer/broker/relay roles clearly separated from trust logic
- verification reproducible without trusting backend state

### Week 7 — April 20 to April 26

Primary focus:

- polish the complete thesis prototype

Planned deliverables:

- stable 3-platform narrative
- stable end-to-end demo path
- updated documentation and architecture materials

### Week 8 — April 27 to May 3

Primary focus:

- demo hardening and thesis presentation readiness

Planned deliverables:

- rehearsable demo
- buffer for bug fixing
- screenshots, diagrams, and final positioning

## Phase A: Contract and model stabilization

Goal:

- make the on-chain model correct and consistent enough that clients can rely on it directly

Tasks:

1. Fix ABI / DTO / service mismatch.
2. Freeze contract interfaces for thesis scope.
3. Decide final EUDI-compatible issuance and presentation formats.
4. Decide final DID / identifier strategy.
5. Decide holder binding model.
6. Tighten trust-anchor and revocation semantics.

Exit criteria:

- contracts are stable
- emitted events are stable
- client SDK can be built on top of fixed interfaces

## Phase B: Shared SDK extraction

Goal:

- move trust logic out of backend service classes and into a reusable client library

Tasks:

1. Generate typed contract bindings.
2. Add DID normalization helpers.
3. Add trust-chain verification helpers.
4. Add credential-status read helpers.
5. Add VC / VP shared models.
6. Add OpenID4VCI / OpenID4VP helpers.
7. Add proof verification helpers.

Exit criteria:

- mobile, admin, and verifier clients can all use the same chain logic

## Phase C: Wallet-first issuance

Goal:

- issuer and holder actions are performed by clients with local keys

Tasks:

1. Remove backend signing from accreditation issuance.
2. Remove backend signing from credential issuance.
3. Add wallet connection to admin client.
4. Make holder wallet receive and store real thesis credentials.
5. Add OpenID4VCI-aligned issuance orchestration.
6. Add direct chain submission or relay-assisted submission.

Exit criteria:

- no server-owned issuer key is required for the demo flow

## Phase D: Verifier-first verification

Goal:

- verification becomes independently reproducible by verifier clients

Tasks:

1. Build verifier module or app.
2. Validate VC signature locally.
3. Validate blockchain status directly.
4. Validate issuer chain directly.
5. Integrate ZKP verification.
6. Add OpenID4VP-aligned request and response flow.
7. Add clear explanation output for demo and thesis analysis.

Exit criteria:

- verifier does not need a backend authority to decide trust

## Phase E: Helper-service minimization

Goal:

- keep only helper services that improve UX without owning trust

Tasks:

1. Convert BlockchainSync into a pure indexer.
2. Replace Presentation service with broker-only session coordination.
3. Keep notifications optional.
4. Keep relay optional.
5. Evaluate whether Identity, Accreditation, Credential, and Verification services should be removed, merged, or downgraded.

Exit criteria:

- helper services are optional from a trust standpoint

## Phase F: Thesis demo hardening

Goal:

- produce one clean end-to-end decentralized demo path

Demo path:

1. Root bootstraps local demo scenario.
2. Member state accredits ministry.
3. Ministry accredits institution.
4. Institution issues credential via wallet.
5. Holder stores VC in wallet.
6. Verifier requests proof.
7. Holder sends VP and mandatory ZKP-backed disclosure.
8. Verifier validates directly against blockchain.

Exit criteria:

- demo proves that helper services are conveniences, not trust anchors

---

## 13. What Success Looks Like

The implementation is successful if the following statements are true:

1. If all helper services are turned off, the verifier can still validate a credential using the blockchain and the presented artifacts.
2. If the indexer is stale, it affects convenience only, not correctness.
3. No backend service holds the issuer's long-term private key.
4. No backend service is required to create a DID.
5. The wallet, admin client, and verifier all use the same identity and credential model.
6. The wallet, admin client, and verifier all use EUDI-aligned issuance and presentation flows.
7. The demo can explain exactly where decentralization exists and where helper infrastructure still exists.

---

## 14. Concrete Migration Decisions for This Repository

Based on the current codebase, the recommended migration path is:

1. Keep `blockchain/` as the center of trust.
2. Keep `mobile-wallet/`, but align it to the same DID model and real chain-backed credentials.
3. Keep `admin-client/`, but convert it into an issuer wallet UI instead of a backend-signing UI.
4. Keep `zkp-service/` as a mandatory project component, but treat it as an implementation detail of proof generation and verification rather than as a trust anchor.
5. Keep `DID.BlockchainSync/`, but rename or reframe it as an indexer.
6. Stop expanding `DID.Identity/`, `DID.Accreditation/`, `DID.Credential/`, and `DID.Verification/` as domain authorities.
7. Extract a shared client SDK so chain reads and verification are not trapped inside server code.

---

## 15. Final Position for the Thesis

The thesis should aim to demonstrate this claim:

> We designed and implemented a blockchain-anchored decentralized identity prototype aligned with EUDI issuance and presentation standards, in which institutional trust and credential status are enforced on-chain, wallets control keys and presentations, and off-chain services are reduced to helper roles for communication, indexing, relaying, and proof execution rather than trust.

That is a stronger and more defensible goal than the previous plan centered on many domain microservices.
