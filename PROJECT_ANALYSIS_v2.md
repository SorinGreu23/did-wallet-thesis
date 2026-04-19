# Project Analysis v2

Date: March 9, 2026

---

**Updated: April 19, 2026 (revision 2).** Originally written March 9, 2026. This revision reflects the completion of all six priority action items. The executive summary, component assessments, problem register, and action list have been updated accordingly. EU member-state voting and governance flows remain explicitly out of scope for the thesis demo.

---

This analysis is based on direct inspection of the repository, not on PROJECT_ANALYSIS.md. README.md and IMPLEMENTATION_PLAN.md were used only as supporting context and were cross-checked against the actual code.

Scope note: full member-state voting for adherence to the EU is not treated here as a required thesis deliverable. Where governance is discussed below, it is evaluated as part of the broader trust-anchor design and contract correctness, not as a mandatory end-to-end feature for the thesis demo.

## 1. Executive Summary

This project is a strong thesis prototype conceptually, but only partially correct in its current implementation with respect to blockchain and decentralized identity principles.

At a high level, the project has three real strengths:

- It models institutional trust as an explicit on-chain hierarchy instead of treating credentials as standalone objects.
- It treats revocation and accreditation status as blockchain concerns rather than purely database concerns.
- It already explores privacy-preserving claims with ZK proofs, which gives the thesis more depth than a standard DID wallet demo.

The six priority issues identified in the original analysis have now been resolved:

- `revokeAccreditation` in `AccreditationRegistry` — fixed: check now uses `msg.sender == owner()` instead of `msg.sender == accred.issuer`.
- `issuerPrivateKey` removed from both `IssueAccreditationRequest` and `IssueCredentialRequest` DTOs; services now always use the backend-configured key.
- `DID.Credential` write endpoints (`Issue`, `Revoke`, `Suspend`) now require `Policies("Institution")`; `DID.Identity` endpoints remain `AllowAnonymous` by design (wallet DID registration is a public operation).
- `DID.Verification` is fully implemented: on-chain credential status + trust chain validation via `CredentialRegistry.verifyCredential`, with optional ZKP delegation to the ZKP service.
- `DID.Presentation` is fully implemented: in-memory challenge/response protocol (5-minute TTL sessions), per-credential verification via DID.Verification, three endpoints (`POST /request`, `POST /submit`, `GET /session/{id}`).
- The mobile wallet's `verifyCredential()` now performs a local Veramo JWT check first, then calls `DID.Verification POST /api/verify/credential` for on-chain status, revocation, and trust chain validity.

One item from the original list remains as planned future work:

- ZKP proof generation in the wallet from held credential attributes (no circuit inputs are derived from wallet-held VC fields yet; the ZKP service is integrated into DID.Verification for verifier-side proof checking but not yet into the wallet-side proof generation flow).

My overall judgment is:

- As a thesis prototype: viable and complete at demo scope.
- As a correct blockchain-native DID architecture: well aligned; the main structural gaps have been closed.
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
- `revokeAccreditation` authorization — **fixed**: `msg.sender == owner() || rootAuthority.isMemberState(msg.sender)`

### 7.2 .NET microservices

Overall assessment: well-structured and now functionally complete for the thesis demo scope.

Implemented services:

- **Identity** — DID generation, key management, resolution
- **Accreditation** — hierarchical accreditation issuance, revocation, trust chain, JWT auth with scope policies
- **Credential** — credential issuance, revocation, suspension; write endpoints now protected by `Policies("Institution")`
- **BlockchainSync** — event polling and RabbitMQ publisher
- **Verification** — on-chain credential status + trust chain validation via `CredentialRegistry.verifyCredential`; optional ZKP delegation to the ZKP service; `POST /api/verify/credential`
- **Presentation** — challenge/response presentation protocol; in-memory sessions (5-minute TTL); per-credential verification via DID.Verification; `POST /api/presentation/request`, `POST /api/presentation/submit`, `GET /api/presentation/session/{id}`

Services still scaffolded (out of thesis-demo scope):

- Notification
- Audit

Remaining minor issues:

- `DID.Identity` `CreateDIDEndpoint` is `AllowAnonymous` by design (wallet onboarding is public); all other write operations in `DID.Identity` are already idempotent on-chain-backed; no policy change required
- Immediate DB writes before blockchain-sync-confirmed convergence (minor; accepted as a read cache)
- `DID.Presentation` uses in-memory session state — sessions are lost on restart (accepted for thesis demo; stateless restarts are a known limitation)

### 7.3 Mobile wallet

Overall assessment: now integrated into the on-chain trust architecture for verification; issuance and ZKP generation remain wallet-local.

Positives:

- Veramo usage is a serious choice, not a toy implementation
- local DID and VC storage are working concepts
- UI is sufficient for a thesis demo baseline
- `verifyCredential` now performs a local Veramo JWT signature check followed by a call to `DID.Verification POST /api/verify/credential` for on-chain status, revocation, and trust chain validity; results are combined into `{ verified, onChain?, error? }`
- `VERIFICATION_SERVICE_URL` and `PRESENTATION_SERVICE_URL` are now defined in `constants/config.ts`

Remaining issues:

- credentials are still issued locally via Veramo without recording them on-chain — wallet-held credentials are not backed by the accreditation chain
- no ZKP proof generation from wallet-held credential attributes (circuit inputs are not yet derived from VC fields)
- no presentation request/response flow (no QR-code challenge handler)

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

#### revokeAccreditation authorization — resolved

`AccreditationRegistry.revokeAccreditation` now uses `msg.sender == owner() || rootAuthority.isMemberState(msg.sender)`. The EU Root deployer can revoke directly; lower-scope issuers cannot.

#### Bootstrap access control

`bootstrapMemberStates` has no `msg.sender` check. In a controlled local demo this is a negligible risk, but it is an acknowledged limitation for decentralization claims about the root trust anchor.

### 9.2 Service and integration gaps

#### Raw private keys in request DTOs — resolved

`issuerPrivateKey` has been removed from `IssueAccreditationRequest` and `IssueCredentialRequest`. Both services now sign on-chain transactions exclusively using their backend-configured `Blockchain:PrivateKey`. Private keys no longer appear anywhere in HTTP request bodies.

#### DID.Credential write endpoints unauthenticated — resolved

`DID.Credential` now has full JWT middleware (`AddAuthentication` + `AddAuthorizationBuilder`) matching the DID.Accreditation setup. `Issue`, `Revoke`, and `Suspend` endpoints require `Policies("Institution")`. Read and resolve endpoints remain `AllowAnonymous`. `DID.Identity` endpoints are `AllowAnonymous` by design: wallet DID registration is a public operation in the trust model.

#### Verification and Presentation services were empty — resolved

Both services are now fully implemented and verified to build successfully:

- **DID.Verification** (`POST /api/verify/credential`): calls `CredentialRegistry.verifyCredential` on-chain, returns `(isValid, status, trustChainValid)`, optionally delegates a ZKP proof to the ZKP service, publishes a `VerificationCompletedEvent` via MassTransit. Configured at port 5216 locally; `http://did-verification:8080` in Docker.
- **DID.Presentation**: three endpoints — `POST /api/presentation/request` (creates challenge with GUID session and hex nonce, 5-minute TTL), `POST /api/presentation/submit` (calls DID.Verification per credential, aggregates results), `GET /api/presentation/session/{id}` (verifier polls for outcome). In-memory `ConcurrentDictionary` state; accepted as a demo limitation. Configured at port 5217 locally; `http://did-presentation:8080` in Docker.

#### Mobile wallet on-chain verification — resolved

`credentialService.ts` now performs a two-stage check: (1) local Veramo JWT signature verification, (2) HTTP call to `DID.Verification POST /api/verify/credential` for on-chain status, revocation, and trust chain validity. Results are combined; network errors degrade gracefully to the local result with a warning.

#### ZKP service — partially integrated

The ZKP service is now integrated into the verifier-side path: `DID.Verification` accepts an optional `ZkpProof` in its request and delegates to `ZkpServiceClient.VerifyProofAsync`. The wallet-side ZKP proof generation path (deriving circuit inputs from wallet-held VC attributes) is still unimplemented and is classified as future work.

## 10. How the Project Should Be Improved

### 10.1 ~~Priority 1: fix revokeAccreditation authorization~~ — done

Fixed: `msg.sender == owner() || rootAuthority.isMemberState(msg.sender)`. No further action required.

### 10.2 ~~Priority 2: implement DID.Verification and DID.Presentation~~ — done

Both services are fully implemented and building. See section 9.2 for the complete feature list.

### 10.3 ~~Priority 3: remove issuerPrivateKey from request DTOs~~ — done

Field removed from both `IssueAccreditationRequest` and `IssueCredentialRequest`. Both services use backend-configured keys only.

### 10.4 ~~Priority 4: add JWT authentication to DID.Credential and DID.Identity~~ — done

`DID.Credential` write endpoints are now protected by `Policies("Institution")`. `DID.Identity` endpoints remain `AllowAnonymous` by design.

### 10.5 ~~Priority 5: connect the wallet to DID.Verification~~ — done

`credentialService.ts` now calls `DID.Verification` for on-chain status after the local Veramo check. Wallet-side ZKP proof generation is still future work.

### 10.6 Remaining: wallet ZKP proof generation

The only remaining integration gap is deriving ZKP circuit inputs from wallet-held VC attributes and generating proofs in the wallet for submission via the presentation flow. This is the single open item from the original priority list.

### 10.7 Priority 6: be explicit about what is centralized

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

1. ✅ Fix `revokeAccreditation` in `AccreditationRegistry.sol` — `msg.sender == owner() || rootAuthority.isMemberState(msg.sender)`.
2. ✅ Implement `DID.Verification` — `POST /api/verify/credential`; on-chain status + trust chain + optional ZKP delegation; build verified.
3. ✅ Implement `DID.Presentation` — challenge/response protocol; `POST /request`, `POST /submit`, `GET /session/{id}`; in-memory sessions; build verified.
4. ✅ Connect the mobile wallet to `DID.Verification` — `verifyCredential()` now does Veramo check + HTTP call to DID.Verification; on-chain result surfaced as `OnChainVerificationResult`.
5. ✅ Remove `issuerPrivateKey` from request DTOs — removed from both `IssueAccreditationRequest` and `IssueCredentialRequest`; services always use backend-configured key.
6. ✅ Add JWT authentication to `DID.Credential` — `Issue`, `Revoke`, `Suspend` require `Policies("Institution")`; `DID.Identity` stays `AllowAnonymous` by design.
7. ⬜ Integrate ZKP proof generation in the wallet from held credential claims — circuit inputs not yet derived from VC fields; this is the single remaining open item.
8. ⬜ Present unimplemented features (full governance ceremony, production key management, eIDAS compliance, Notification and Audit services) as explicit future work in the thesis.

Items 1–6 are complete. Item 7 is the remaining integration work. Item 8 is a writing task.