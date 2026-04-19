# Project Analysis v2

Date: March 9, 2026

---

**Updated: April 19, 2026.** Originally written March 9, 2026. Resolved findings have been removed. Only open issues remain documented below. EU member-state voting and governance flows are explicitly out of scope for the thesis demo.

---

This analysis is based on direct inspection of the repository, not on PROJECT_ANALYSIS.md. README.md and IMPLEMENTATION_PLAN.md were used only as supporting context and were cross-checked against the actual code.

Scope note: full member-state voting for adherence to the EU is not treated here as a required thesis deliverable. Where governance is discussed below, it is evaluated as part of the broader trust-anchor design and contract correctness, not as a mandatory end-to-end feature for the thesis demo.

## 1. Executive Summary

This project is a strong thesis prototype conceptually, but only partially correct in its current implementation with respect to blockchain and decentralized identity principles.

At a high level, the project has three real strengths:

- It models institutional trust as an explicit on-chain hierarchy instead of treating credentials as standalone objects.
- It treats revocation and accreditation status as blockchain concerns rather than purely database concerns.
- It already explores privacy-preserving claims with ZK proofs, which gives the thesis more depth than a standard DID wallet demo.

However, the current implementation has several remaining open issues:

- `revokeAccreditation` in `AccreditationRegistry` does not match the intended model: the EU Root deployer address cannot currently revoke directly, and any issuer at any scope level (including ministries and institutions) can revoke accreditations they issued.
- `issuerPrivateKey` is passed as a request body field in both accreditation and credential issuance endpoints — private keys should not travel over HTTP.
- `DID.Credential` and `DID.Identity` service endpoints are all `AllowAnonymous`.
- `DID.Verification` and `DID.Presentation` are empty scaffolds.
- The mobile wallet's credential verification is local Veramo only — no on-chain status check.
- The ZKP service has no integration path into the wallet or verification flow.

My overall judgment is:

- As a thesis prototype: viable and promising.
- As a correct blockchain-native DID architecture: largely aligned, with the remaining gaps above as the main open work.
- As a production-grade or eIDAS-like platform: not currently feasible without major redesign in key management, authentication, and interoperability.

## 2. Scope and Method

The following areas were reviewed directly in code:

- Smart contracts in blockchain/contracts
- Hardhat tests and deployment in blockchain/test and blockchain/scripts
- Shared blockchain integration and .NET service implementations in DID.WalletThesis/src
- Mobile wallet implementation in mobile-wallet
- ZKP service in zkp-service
- Docker and runtime composition files in the repository root

Particular attention was given to:

- On-chain trust enforcement
- DID method consistency
- Issuance, verification, revocation, and accreditation flows
- Centralization pressure points
- Feasibility of the planned demo and of a broader system

## 3. High-Level Architecture Assessment

The repository describes a hybrid architecture:

- Smart contracts store trust anchors, accreditations, and credential status
- .NET microservices provide APIs, persistence, and event synchronization
- RabbitMQ distributes blockchain-derived events
- PostgreSQL is used as per-service storage
- A React Native wallet stores DIDs and credentials locally
- A Node.js ZKP service generates and verifies proofs

This is a reasonable thesis architecture. It is not fully decentralized by design, but it does not need to be. A realistic DID system can still include centralized operational components as long as those components do not become the trust anchor.

The key question is whether the blockchain remains the real trust anchor or whether the services quietly become one. The answer is mostly yes:

- The smart contracts enforce the trust chain, issuance authorization, and credential status.
- The service layer acts as a persistence cache and API helper, not a trust authority.
- The wallet uses the same `did:ethr:sepolia` identity model as the backend.

The remaining centralization is operational: private keys are managed through API parameters and backend configuration rather than hardware-secured wallets. This is a known and intentional demo compromise.

So the project is best described as a blockchain-anchored identity platform with a hybrid architecture — decentralized for trust, operationally centralized as an accepted thesis-scope shortcut.

## 4. Strengths of the Project

### 4.1 Strong thesis framing

The thesis topic is well chosen. Modeling EU-style hierarchical trust, accreditation, credential issuance, revocation, and privacy-preserving verification is academically strong and technically rich.

This gives you multiple dimensions to discuss:

- governance and trust anchors
- issuer authorization
- revocation models
- privacy-preserving claims disclosure
- on-chain vs off-chain boundaries
- interoperability tradeoffs

That is much stronger than a simple wallet that only stores signed credentials.

### 4.2 Explicit trust hierarchy on-chain

The best part of the design is that accreditations are not implicit. The hierarchy is modeled directly in the smart contracts:

- EU root authority
- member state
- ministry
- institution
- department

That is a meaningful design choice. It moves part of institutional trust from documentation and policy into enforceable logic.

The AccreditationRegistry contract also includes:

- explicit scope levels
- parent-child accreditation chaining
- trust-chain reconstruction
- validation of expiry and revocation state

This is a solid foundation for demonstrating why blockchain can add value beyond simple signed JSON.

### 4.3 Revocation and accreditation status are treated seriously

The CredentialRegistry contract validates issuer accreditation and exposes active/revoked/suspended state. That is one of the real value-adds of a registry-backed architecture.

In many DID/VC demos, revocation is hand-wavy. Here, it is part of the actual system model.

### 4.4 Good architectural separation in the .NET codebase

The implemented services generally follow a clean separation:

- Application services
- Domain entities and repositories
- Infrastructure for persistence and blockchain access
- Event-driven sync via BlockchainSync and RabbitMQ

For a thesis project, this is a good level of engineering discipline.

### 4.5 ZKP component adds meaningful privacy depth

The ZKP service is not just cosmetic. It provides concrete proof-generation and verification flows for age and graduation-year predicates. Even though it is still loosely coupled to the VC flow, it demonstrates an important principle: selective disclosure and predicate proofs are a much better privacy story than full credential disclosure.

### 4.6 Good incremental implementation strategy

The repository shows phased development and clear separation between foundation work, core services, verification, presentation, and support services. That is good project management for a thesis, even if some pieces are still unfinished.

## 5. Does the Project Respect Blockchain Principles Correctly?

Short answer: partially.

It respects some blockchain principles well, but it violates or weakens others in important places.

### 5.1 What it gets right

#### Blockchain used for shared trust state, not just for storage theater

The contracts are not merely decorative. They encode:

- who can issue certain kinds of accreditations
- whether a trust chain is still valid
- whether a credential is active, revoked, or suspended

That is a legitimate use of blockchain.

#### Verification logic is chain-aware in the backend

`DID.Credential.VerifyAsync` calls `CredentialRegistry.verifyCredential` on-chain and decodes a three-field tuple (isValid, status, trustChainValid). The backend verification path is genuinely blockchain-backed.

The gap is in the mobile wallet: `credentialService.ts` calls only `agent.verifyCredential` — a local Veramo signature check. It does not contact the blockchain or any backend service to check on-chain status, revocation, or issuer accreditation.

#### Revocation and issuer authorization are on-chain concerns

That is stronger than many academic prototypes.

### 5.2 Where it breaks or weakens blockchain principles

#### Deployment bootstrap lacks access control

The deploy script bootstraps initial member states and completes the deployment ceremony via `bootstrapMemberStates`. This function has no `msg.sender` access control — any address that calls it before the deployer can register arbitrary addresses as member states and mark the ceremony complete.

In practice the deploy script calls it immediately after contract deployment, so the window is extremely small on a local Hardhat network. For the thesis demo this is an acknowledged design limitation, not a demo blocker.

The `addDeploymentWitness` function (an alternative ceremony path requiring 18/27 witness signatures) also accepts any address as a witness without signature verification. This path is dormant in the thesis demo — `bootstrapMemberStates` is used instead. Full EU governance ceremony is out of scope.

#### Revocation authorization in AccreditationRegistry is incorrect

`revokeAccreditation` uses:

```solidity
require(msg.sender == accred.issuer || rootAuthority.isMemberState(msg.sender), "Unauthorized to revoke");
```

This has two problems relative to the intended rule (only active member states or the EU Root can revoke):

1. `msg.sender == accred.issuer` allows any issuer level — including ministries and institutions — to revoke accreditations they issued. Per the intended model, only active member states and the EU Root should hold revocation authority.

2. The EU Root deployer address (`owner`) is not registered in the `memberStates` mapping, so `rootAuthority.isMemberState(owner)` returns `false`. The EU Root cannot currently revoke any accreditation directly.

Fix: replace the check with `msg.sender == owner || rootAuthority.isMemberState(msg.sender)`.

#### The database is not the sole operational source of truth

Some service paths write to the database immediately after submitting a blockchain transaction, rather than waiting for the BlockchainSync event-driven confirmation. This is acceptable as a read-cache optimization, but the boundary should be clearly documented.

### 5.3 Verdict on blockchain correctness

The issuance authorization logic is correctly aligned with the intended hierarchy: MemberState accreditations require the EU Root; Ministry accreditations require the EU Root or the subject of a valid MemberState accreditation; lower scopes require their parent subject. The contract/service interface is fully aligned.

The single concrete contract bug is the revocation authorization check. One-line fix.

I would rate it:

- strong at modeling trust-chain data structures and enforcing issuance hierarchy
- strong at on-chain credential status management (backend path)
- acceptable at root bootstrap for a demo context
- needs one small fix in `revokeAccreditation`

## 6. Does the Project Respect Decentralized Identity Principles Correctly?

Short answer: only partially.

The project adopts DID and VC terminology and some supporting tooling, but the implementation is not yet consistent around one DID model or one end-to-end identity flow.

### 6.1 What it gets right

#### It understands that identity and credentialing are separate concerns

The system distinguishes:

- DID creation and resolution
- accreditation/issuer authority
- credential issuance and revocation
- proof presentation

That separation is correct and important.

#### It uses W3C VC-oriented tooling in the wallet

The mobile wallet uses Veramo and standard VC concepts. That is a strong choice for a thesis because it aligns with real DID tooling and terminology.

#### It recognizes the importance of selective disclosure

The ZKP service reflects a correct DID/VC privacy principle: verifiers should often learn only the claim outcome, not the full underlying attribute set.

### 6.2 Where DID alignment is weak

#### The DID Identity service is a convenience cache, not a trust authority

`DID.Identity` stores locally-derived DID documents in a database and exposes them via REST. This is correct by design: the service exists so the admin platform can look up and display DID information. The actual identity authority comes from the Ethereum address and from `did:ethr:sepolia` resolution rules, not from the database. The service can be rebuilt from on-chain events at any time.

#### The wallet is not yet integrated into the on-chain credential flow

The mobile wallet has the correct `did:ethr:sepolia` identity model and secure local key management via `expo-secure-store`. What is still missing:

- Credentials issued by backend institutions (on-chain-recorded) cannot yet be received or stored by the wallet.
- `verifyCredential` in `credentialService.ts` calls only `agent.verifyCredential` — a local Veramo JWT signature check. It does not contact the blockchain or `DID.Credential` service to check on-chain status, revocation, or issuer accreditation validity.
- No presentation request/response flow (QR-code challenge).
- No ZKP proof generation from wallet-held credentials.

### 6.3 Verdict on DID correctness

The project is now aligned on DID method across wallet, backend, and blockchain. The remaining gaps are in the wallet's integration depth (no on-chain status check, no backend-issued credential receipt, no ZKP presentation flow) and in the unimplemented Verification and Presentation services.

## 7. Component-by-Component Assessment

### 7.1 Smart contracts

Overall assessment: conceptually strong, but root trust-anchor and authorization details need tightening.

Positives:

- explicit hierarchy and scopes
- on-chain validation of trust chains
- on-chain credential status model
- revocation and suspension support

Main issues:

- `bootstrapMemberStates` has no `msg.sender` access control — any address can register arbitrary member states before the deployer does; accepted demo limitation
- `addDeploymentWitness` accepts any address as a witness without signature verification; this path is dormant in the demo and the full governance ceremony is out of scope
- `revokeAccreditation` authorization bug: the EU Root (`owner`) cannot currently revoke directly; any issuer at any scope level can revoke their own issued accreditations — fix: `msg.sender == owner || rootAuthority.isMemberState(msg.sender)`

### 7.2 .NET microservices

Overall assessment: well-structured, but partially unfinished and somewhat over-centralized operationally.

Implemented services appear to be:

- Identity
- Accreditation
- Credential
- BlockchainSync

Services still effectively scaffolded or incomplete:

- Verification
- Presentation
- Notification
- Audit

Main issues:

- `DID.Credential` and `DID.Identity` endpoints are all `AllowAnonymous`; `DID.Accreditation` issue endpoint is protected by `Policies("Ministry")` but `DID.Credential` write endpoints are not
- `issuerPrivateKey` field in both `IssueAccreditationRequest` and `IssueCredentialRequest` — raw private keys can be passed over HTTP; the primary remaining security concern
- `DID.Verification` and `DID.Presentation` are empty ASP.NET scaffolds. Their intended roles:
  - **DID.Verification**: receives a credential ID or presentation from a verifier, calls `CredentialRegistry.verifyCredential` on-chain, validates the issuer trust chain, optionally delegates ZKP proof verification to the ZKP service, and returns a trust decision
  - **DID.Presentation**: manages the presentation protocol — receives a presentation request from a verifier, generates a challenge, relays it to the wallet, receives the presentation response, and routes it to DID.Verification for evaluation
- immediate DB writes before blockchain-sync-confirmed convergence (minor; acceptable as a read cache)

### 7.3 Mobile wallet

Overall assessment: a useful standalone DID/VC wallet prototype, but not yet integrated into the thesis trust architecture.

Positives:

- Veramo usage is a serious choice, not a toy implementation
- local DID and VC storage are working concepts
- UI seems sufficient for a thesis demo baseline

Main issues:

- issues credentials locally via Veramo without recording them on-chain — wallet-held credentials are not backed by the accreditation chain
- `verifyCredential` is a local Veramo signature check only; no on-chain status, revocation, or issuer accreditation validation
- no ZKP proof generation from wallet-held credentials
- no presentation request/response flow

### 7.4 ZKP service

Overall assessment: a good adjunct privacy component, but still isolated from the main credential lifecycle.

Positives:

- actual proof generation and verification implemented
- clear circuit separation for age and graduation-year predicates
- academically valuable privacy component

Main issues:

- proofs are generated directly from numeric request inputs, not from validated credential-derived claims
- no binding shown between a VC, its issuer, and the proof input source
- no access control or anti-abuse controls on the service endpoints
- not yet integrated into a full verifier presentation flow

This means the ZKP service proves that the circuits work, but not yet that the overall privacy-preserving credential verification pipeline is complete.

## 8. Key Strengths to Keep

These are the parts worth preserving and strengthening rather than redesigning away:

1. The hierarchical on-chain accreditation model.
2. The idea that blockchain records issuer authority and credential state, while services provide convenience APIs.
3. The event-driven synchronization pattern.
4. The use of Veramo in the wallet for standards-oriented DID/VC handling.
5. The inclusion of zero-knowledge proofs for selective disclosure.
6. The database-per-service and bounded-context structure in the .NET code.

## 9. Main Problems and Risks

### 9.1 Contract-level issues

#### revokeAccreditation authorization bug

`AccreditationRegistry.revokeAccreditation` allows any issuer (including ministries and institutions) to revoke accreditations they issued, and prevents the EU Root (`owner`) from revoking directly. Neither behavior matches the intended model. One-line fix: `msg.sender == owner || rootAuthority.isMemberState(msg.sender)`.

#### Bootstrap access control

`bootstrapMemberStates` has no `msg.sender` check. In a controlled local demo this is a negligible risk, but it is an acknowledged limitation for decentralization claims about the root trust anchor.

### 9.2 Service and integration gaps

#### Raw private keys in request DTOs

`issuerPrivateKey` is an optional field in both `IssueAccreditationRequest` and `IssueCredentialRequest`. This means private keys can be transmitted over HTTP. Even in a demo context, this is the primary security concern and should be either removed or replaced with a backend-configured signing key approach that never surfaces the key in the request body.

#### DID.Credential and DID.Identity have no JWT authentication

All endpoints in `DID.Credential` and `DID.Identity` use `AllowAnonymous`. `DID.Accreditation` issue endpoint is protected by `Policies("Ministry")`. The remaining services need JWT middleware added.

#### Verification and Presentation services are empty

`DID.Verification` and `DID.Presentation` are both `dotnet new webapi` scaffolds (weatherforecast placeholder). These are the two services that complete the thesis trust story:

- `DID.Verification`: verifier-side endpoint — accepts a credential ID or presentation, calls `CredentialRegistry.verifyCredential` on-chain, validates the issuer trust chain, delegates ZKP proof verification to the ZKP service, returns a trust decision
- `DID.Presentation`: presentation protocol handler — generates presentation challenges, receives wallet responses, routes to DID.Verification

Without these, the system is issuance-only.

#### Mobile wallet not integrated with on-chain verification

`credentialService.ts` verifies credentials with a local Veramo call only. No on-chain status, revocation, or issuer accreditation check. Wallet-issued credentials are also not recorded on-chain.

#### ZKP service is isolated

The ZKP service has working circuits for age and graduation-year predicates but no integration with the wallet, the presentation flow, or the verification services.

## 10. How the Project Should Be Improved

### 10.1 Priority 1: fix revokeAccreditation authorization

Change the access control check in `AccreditationRegistry.revokeAccreditation` from:

```solidity
require(msg.sender == accred.issuer || rootAuthority.isMemberState(msg.sender), ...);
```

to:

```solidity
require(msg.sender == owner || rootAuthority.isMemberState(msg.sender), ...);
```

This is the only contract-level correctness bug.

### 10.2 Priority 2: implement DID.Verification and DID.Presentation

This is the most significant remaining gap in demonstrating why the architecture matters.

Minimum viable verification flow:

1. Verifier calls DID.Verification with a credential ID
2. DID.Verification calls `CredentialRegistry.verifyCredential` on-chain
3. DID.Verification calls `AccreditationRegistry.validateTrustChain` on-chain for the issuer
4. If a ZKP proof is attached, delegate verification to the ZKP service
5. Return a structured trust decision

DID.Presentation wraps the above with a challenge/response protocol so the wallet can respond to presentation requests.

### 10.3 Priority 3: remove issuerPrivateKey from request DTOs

Private keys should not travel over HTTP. Options:

- Remove the field and always use the backend-configured key for demo purposes
- If per-issuer signing is needed, use a server-side key vault lookup by issuer DID, not client-supplied keys

At minimum, document this as a demo compromise and note the intended replacement approach.

### 10.4 Priority 4: add JWT authentication to DID.Credential and DID.Identity

Apply the same `Policies("...")` pattern already implemented in `DID.Accreditation` to the write endpoints of `DID.Credential` and `DID.Identity`.

### 10.5 Priority 5: integrate the wallet with on-chain verification and ZKP

- Add an on-chain status check call in `credentialService.ts` (call `DID.Credential`'s verify endpoint or call the blockchain directly)
- Add a ZKP proof generation flow from wallet-held credential attributes
- Add a presentation request handler so the wallet can respond to verifier challenges

### 10.6 Priority 6: be explicit about what is centralized

You do not need to eliminate all centralization in a bachelor thesis. Be precise about where it remains:

- backend-configured private keys for on-chain signing
- service-hosted APIs as convenience helpers
- local Hardhat network
- demo-only `issuerPrivateKey` shortcut

That honesty makes the thesis stronger, not weaker.

## 11. Feasibility Study

## 11.1 Technical feasibility

### For a thesis prototype

Technical feasibility is medium to high, provided scope is controlled.

Why it is feasible:

- the core smart contracts already exist
- accreditation flows are already modeled
- several core services are implemented
- the wallet and ZKP service already provide building blocks
- the remaining missing pieces are significant but not conceptually new

Why it is not yet easy:

- verification/presentation flows still need real implementation
- wallet integration with on-chain status and ZKP is not done
- one contract authorization bug needs fixing

Conclusion:

The project is feasible as a thesis-grade demonstrator if you narrow the target to a high-quality vertical slice instead of trying to finish a full eIDAS-scale platform.

Given your scope note, that vertical slice should not include a full member-state adherence voting workflow. It should focus on the accreditation chain, credential issuance, verification, and privacy-preserving presentation.

### For a production or near-production system

Technical feasibility in the current architecture is low.

Major blockers:

- immature root-governance model
- centralized key handling
- incomplete verification and presentation stack
- limited interoperability model
- insufficient operational security controls
- no realistic decentralized infrastructure assumptions

This does not mean the idea is bad. It means the current implementation is a prototype, not a deployable trust infrastructure.

## 11.2 Schedule feasibility

Assuming a bachelor thesis timeline, the project remains feasible if you prioritize correctly.

Realistic scope for completion:

1. Fix `revokeAccreditation` authorization (one-line contract change).
2. Implement one end-to-end verification scenario (DID.Verification calling on-chain + ZKP service).
3. Implement a minimal presentation protocol (wallet responds to a verifier challenge).
4. Connect the wallet to receive and verify on-chain-backed credentials.
5. Present the remaining services as future work if necessary.

Unrealistic scope for the same timeline:

- full decentralized governance UI and workflows
- production-grade key management
- fully interoperable multi-method DID ecosystem
- full-scale eIDAS 2.0 compliance
- hardened mobile production wallet

So the project is schedule-feasible only if you defend a narrower and more disciplined completion target.

## 11.3 Operational feasibility

For a controlled academic demo environment, operational feasibility is good.

Why:

- Dockerized infrastructure is manageable
- Hardhat local chain simplifies testing
- PostgreSQL and RabbitMQ are standard components
- the system can be demonstrated locally without external dependencies

But operational feasibility drops quickly outside a demo context because:

- private keys are handled too simply
- no high-availability assumptions are present
- no production monitoring/security posture is evident
- trust still depends heavily on local configuration and environment integrity

## 11.4 Research feasibility

Research feasibility is high.

Even if the implementation remains partial, the thesis can still make a strong contribution by evaluating:

- when blockchain adds value to institutional trust chains
- where centralized services remain necessary
- how DIDs, VCs, and ZKPs fit together in practice
- what architectural compromises are required in a working prototype

This is an important point: the project does not need to become a production platform to become a strong thesis.

## 12. Recommended Target State for the Thesis

The most defensible thesis outcome is not "we built a fully decentralized EU identity system".

The most defensible thesis outcome is:

"We built and evaluated a blockchain-anchored prototype for hierarchical institutional trust, credential status verification, and privacy-preserving claim presentation, and we identified the remaining centralization points and deployment challenges."

That framing matches your scope much better than any claim suggesting that full EU member-state adherence governance is part of the required implementation.

That claim is realistic, technically defensible, and academically stronger.

## 13. Final Verdict

This project has real merit.

It is not a superficial blockchain add-on. The trust-chain idea is meaningful, the contract layer is non-trivial, the service architecture is disciplined, and the ZKP component gives the work genuine depth.

At the same time, the current system does not yet fully respect decentralized identity and blockchain principles correctly in an end-to-end sense.

The main reasons are:

- revocation authorization in `AccreditationRegistry` does not match the intended model
- incomplete verification/presentation flows
- mobile wallet not yet integrated with on-chain status or ZKP

My final assessment is:

- Concept quality: high
- Current implementation coherence: medium-high
- Decentralization fidelity: medium (intentionally hybrid; honest about it)
- Thesis feasibility: high if the above gaps are closed
- Production feasibility: low in the current state

## 14. Priority Action List

If you want the highest return on effort, do these in order:

1. Fix `revokeAccreditation` in `AccreditationRegistry.sol` — change `msg.sender == accred.issuer` to `msg.sender == owner`.
2. Implement `DID.Verification` — on-chain credential status + trust chain validation + ZKP delegation.
3. Implement `DID.Presentation` — presentation challenge/response protocol for the wallet.
4. Connect the mobile wallet to `DID.Verification` for on-chain status checks instead of local Veramo only.
5. Integrate ZKP proof generation in the wallet from held credential claims.
6. Remove `issuerPrivateKey` from request DTOs; use backend-configured signing only.
7. Add JWT authentication (`Policies("...")`) to `DID.Credential` and `DID.Identity` write endpoints.
8. Present unimplemented features (full governance ceremony, production key management, eIDAS compliance) as explicit future work.

Items 1–5 are the core thesis demo. Items 6–8 are cleanup and honesty.