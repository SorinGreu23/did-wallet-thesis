# Project Analysis v2

Date: March 9, 2026

This analysis is based on direct inspection of the repository, not on PROJECT_ANALYSIS.md. README.md and IMPLEMENTATION_PLAN.md were used only as supporting context and were cross-checked against the actual code.

Scope note: full member-state voting for adherence to the EU is not treated here as a required thesis deliverable. Where governance is discussed below, it is evaluated as part of the broader trust-anchor design and contract correctness, not as a mandatory end-to-end feature for the thesis demo.

## 1. Executive Summary

This project is a strong thesis prototype conceptually, but only partially correct in its current implementation with respect to blockchain and decentralized identity principles.

At a high level, the project has three real strengths:

- It models institutional trust as an explicit on-chain hierarchy instead of treating credentials as standalone objects.
- It treats revocation and accreditation status as blockchain concerns rather than purely database concerns.
- It already explores privacy-preserving claims with ZK proofs, which gives the thesis more depth than a standard DID wallet demo.

However, the current implementation also has several structural weaknesses that materially limit how "decentralized" it is in practice:

- Root trust and bootstrap logic are not enforced strongly enough on-chain.
- The service layer still centralizes issuance and key control.
- The mobile wallet currently uses a DID method and credential flow that are disconnected from the blockchain-backed architecture.
- Some core .NET service calls are out of sync with the current smart contract interfaces, which creates a serious execution risk for the end-to-end credential flow.
- Important parts of the intended architecture, especially Verification and Presentation, are still not implemented.

My overall judgment is:

- As a thesis prototype: viable and promising.
- As a correct blockchain-native DID architecture: partially aligned, but not yet coherent end-to-end.
- As a production-grade or eIDAS-like platform: not currently feasible without major redesign in trust-anchor governance, key management, authentication, and interoperability.

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

The key question is whether the blockchain remains the real trust anchor or whether the services quietly become one. Right now, the answer is mixed:

- The smart contracts do enforce meaningful parts of the trust chain.
- The service layer still introduces centralized control in issuance and identity handling.
- The wallet is currently not integrated with the same DID model as the blockchain-backed services.

So the project is best described as a blockchain-assisted identity platform with decentralized design intent, not yet a coherent decentralized identity system end-to-end.

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

#### Verification logic is intended to be chain-aware

The design intent is correct: verification should not trust a single service database, but should depend on on-chain state and on-chain trust relationships.

#### Revocation and issuer authorization are on-chain concerns

That is stronger than many academic prototypes.

### 5.2 Where it breaks or weakens blockchain principles

#### Root trust bootstrapping is too weak

In EURootAuthority.sol, the deployment ceremony and initial member-state bootstrap are not robust enough to justify strong decentralization claims around the root trust anchor.

Problems:

- addDeploymentWitness allows anyone to add an arbitrary witness address. It does not verify a real signature.
- bootstrapMemberStates can be called externally and only checks whether it has already been done. There is no access control restricting who may perform the initial bootstrap.
- deploymentCeremonyCompleted can be reached through bootstrap instead of through a verifiable governance ceremony.

This means the root of trust is not cryptographically or institutionally strong enough yet.

For your scope, this matters mainly because it weakens the credibility of the trust anchor, not because a full EU member-state admission voting workflow must be implemented in the thesis demo.

#### Governance membership is inconsistent

Proposal and voting logic in EURootAuthority uses memberStates[msg.sender] rather than checking the active flag through isMemberState.

That means a removed or inactive member state may still retain governance power if memberStates[msg.sender] remains true.

Also, proposal approval is calculated against memberStateList.length, which includes historical addresses and not necessarily only active members. That weakens governance semantics.

Because EU adherence voting is out of scope, I would classify this below accreditation, credential, verification, and DID-consistency issues in delivery priority. It still matters as contract-design correctness and should be documented honestly.

#### The hierarchy is more centralized than the documentation suggests

In AccreditationRegistry.sol, the authorization logic is stricter and more centralized than the documentation narrative implies.

Examples:

- MemberState accreditations can only be issued by the contract owner.
- Ministry accreditations can also only be issued by the contract owner.
- Only lower levels like Institution and Department can be issued by the parent subject or root deployer.

So while the README describes a hierarchy where member states accredit ministries, the actual contract logic centralizes more of the issuance flow at the contract owner level.

#### Revocation authority is broader than intended

AccreditationRegistry.sol comments say only issuer or root authority should revoke, but the implementation allows any active member state to revoke because it checks rootAuthority.isMemberState(msg.sender).

That is a strong governance choice if intentional, but the code and stated model are not aligned. If it is unintentional, it is a significant logic bug.

#### Smart-contract/service interface drift is a serious problem

This is one of the most important findings in the whole repository.

The current .NET Credential service appears to target a different contract interface than the current Solidity contract and ABI.

Concrete examples:

- CredentialService calls CredentialRegistry.issueCredential, but the contract exposes recordCredential.
- CredentialService calls verifyCredential expecting a single bool, but the contract returns a tuple: isValid, status, trustChainValid.
- OnChainCredentialDto expects revoked and suspended boolean fields, but the contract stores a status enum and a credentialHash field instead.
- CredentialService calls suspendCredential without a reason argument, but the contract requires a reason string.

This is not a minor issue. It suggests the service layer and contract layer have drifted apart. If left unresolved, the core credential issuance and verification demo may fail or decode values incorrectly.

#### The blockchain is not yet the sole operational source of truth

The architecture says blockchain is the source of truth, but some service paths write to the database immediately after transactions rather than waiting for sync-derived event confirmation.

That is acceptable as a cache optimization only if carefully handled, but right now it weakens the neat conceptual boundary.

### 5.3 Verdict on blockchain correctness

The project demonstrates real blockchain thinking, but not yet fully correct root trust-anchor design or execution integrity.

I would rate it:

- good at modeling trust-chain data structures
- moderate at using blockchain for issuer/credential state
- weak at root bootstrap rigor and integration consistency

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

#### DID method inconsistency is a major architectural problem

The backend and blockchain-side services assume did:ethr:sepolia identifiers.

The mobile wallet creates and manages did:key identifiers.

That is not a small implementation detail. It means the wallet and the backend are currently participating in different identity ecosystems:

- backend identity model: Ethereum-address-based DID references
- wallet identity model: locally generated key-based DIDs

As a result, the current mobile wallet is not truly participating in the same trust model as the blockchain-backed services.

#### The DID service is centralized and not strongly anchored

The Identity service creates DID documents off-chain, stores them in a database, and returns them through REST endpoints.

That may be acceptable for a demo, but it is not strong decentralized identity design by itself. It behaves more like an identity registry service than a decentralized resolver.

The backend-generated DID documents are not meaningfully anchored to a decentralized resolution process beyond the address naming convention.

#### The wallet is currently a local VC demo, not yet the on-chain thesis wallet

The mobile wallet issues self-issued demo credentials locally through Veramo, verifies them locally, and stores them in a local SQLite-backed Veramo store.

That is useful for UI and wallet experimentation, but it is not yet integrated with:

- the accreditation chain
- on-chain credential status
- backend verification flows
- QR/presentation workflows

So the wallet currently demonstrates wallet capabilities in isolation, not the full thesis architecture.

#### Hardcoded wallet encryption secret is a security weakness

The Veramo agent uses a hardcoded SECRET_KEY in the mobile code. For a prototype this may be tolerable temporarily, but it is not acceptable as a stable design. It weakens the holder-control story and creates a security problem if the app is distributed.

### 6.3 Verdict on DID correctness

The project is directionally aligned with DID/VC principles, but it is not yet a coherent DID system end-to-end.

The biggest reason is that the wallet, backend, and blockchain are not all using the same identity model or issuance path.

## 7. Component-by-Component Assessment

### 7.1 Smart contracts

Overall assessment: conceptually strong, but root trust-anchor and authorization details need tightening.

Positives:

- explicit hierarchy and scopes
- on-chain validation of trust chains
- on-chain credential status model
- revocation and suspension support

Main issues:

- weak bootstrap ceremony
- governance membership logic inconsistency in the root contract, though not on the main critical path for your scoped demo
- broader-than-claimed revocation power
- more centralized issuance than documentation suggests

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

- anonymous HTTP endpoints on core operations
- central signer model through configured private keys
- optional raw issuer private key passed into issuance flow for accreditations
- immediate DB writes in some paths before sync-confirmed convergence
- service/contract ABI drift in credential flows

### 7.3 Mobile wallet

Overall assessment: a useful standalone DID/VC wallet prototype, but not yet integrated into the thesis trust architecture.

Positives:

- Veramo usage is a serious choice, not a toy implementation
- local DID and VC storage are working concepts
- UI seems sufficient for a thesis demo baseline

Main issues:

- uses did:key while the backend uses did:ethr:sepolia
- issues self-signed sample credentials rather than chain-backed credentials
- verifies only local VC signature validity, not blockchain revocation/accreditation state
- hardcoded encryption secret
- empty storageService.ts suggests unfinished wallet persistence abstraction

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

### 9.1 Critical risks

#### Critical risk 1: contract/service interface mismatch

This is the most urgent technical risk.

If the Credential service is calling methods or decoding outputs that do not match the deployed ABI, the core credential flow may not work reliably at all.

This must be treated as a release blocker for the thesis demo.

#### Critical risk 2: inconsistent DID model

The current wallet and backend are not aligned on DID method. Until that is fixed, the system is architecturally split.

#### Critical risk 3: root trust-anchor design is not strong enough

The root trust anchor is central to the thesis claim. Right now, the root ceremony and governance logic are not strong enough to support strong decentralization claims.

Given your scope note, this should be framed less as a missing governance workflow and more as a limit on how strongly the current prototype can claim decentralized institutional bootstrapping.

### 9.2 High risks

#### High risk 1: central private key dependence

The services rely heavily on configured private keys. That creates a central operational trust point.

For a thesis demo this can be tolerated, but the analysis and presentation should explicitly state that this is a prototype compromise, not a final decentralized design.

#### High risk 2: verification and presentation services are missing

The trust story of a DID platform is completed at verification time. Because the Verification and Presentation layers are still missing, the most important user-facing part of the architecture is still not implemented.

#### High risk 3: documentation and runtime behavior are not fully aligned

There are contradictions around Hardhat persistence and parts of the intended architecture. That is manageable, but it increases demo fragility.

For example:

- README claims Hardhat chain state persists across container restarts
- DEMO.md says contract deployment must be rerun because the chain is ephemeral
- docker-compose.infra.yml does not mount a volume for Hardhat state

The compose file currently supports the DEMO.md interpretation more than the README interpretation.

## 10. How the Project Should Be Improved

### 10.1 Priority 0: fix the contract-service drift

Before anything else, make the smart contracts, ABIs, DTOs, and service calls consistent.

This includes:

- regenerate ABIs from the current Solidity contracts
- regenerate or fix all Nethereum DTO mappings
- update CredentialService calls to match current function names and signatures
- update verifyCredential handling to decode the tuple correctly
- update status decoding to use the enum-based contract output
- add automated compatibility tests so this drift cannot happen again silently

Without this, the architectural discussion becomes less important because the demo itself is at risk.

### 10.2 Priority 1: choose one DID strategy and make the whole system consistent

You need a single coherent answer to this question:

What is the authoritative DID method in this project?

You currently have at least three identity notions:

- did:ethr:sepolia in the backend
- did:key in the wallet
- did:web strings in root/member-state metadata

A coherent thesis can still use multiple DID methods, but only if their roles are explicit.

Recommended direction:

- Use did:ethr for blockchain-controlled institutional actors if that is your core trust model.
- Use did:key only for local holder-controlled identities if you clearly explain why.
- If you keep did:web for public institutions such as europa.eu, define exactly how it relates to on-chain authority.

Then implement real interoperability between those roles rather than leaving them as parallel concepts.

### 10.3 Priority 2: tighten on-chain trust-anchor logic and authorization

Fix the root authority model so the thesis can defend its decentralization claims without implying that full EU membership governance is part of the implemented scope.

Recommended improvements:

- restrict bootstrapMemberStates to a controlled bootstrap mechanism or remove it after deployment
- replace pseudo-witness registration with actual signature verification or a simpler but honest bootstrap model
- if the root-governance code remains part of the contract design, ensure only active member states can propose and vote
- if the root-governance code remains part of the contract design, make thresholds based on active members, not historical entries
- align revocation rights with the intended governance model
- make issuance authority match the written institutional hierarchy

### 10.4 Priority 3: stop exposing raw private keys in service workflows

Passing issuer private keys through API request payloads is not a sound design, even for a prototype.

Better options:

- keep signing inside dedicated issuer services or wallets
- use per-issuer service accounts only in a limited demo environment
- document future migration to HSM or vault-backed signing

If you cannot fully redesign this before thesis completion, at least clearly document that it is a demo compromise.

### 10.5 Priority 4: implement the actual verification path

The thesis needs a verifier story that demonstrates why the architecture matters.

Minimum viable verification flow:

- holder presents credential or proof
- verifier extracts credential identifier
- verifier checks on-chain credential status
- verifier checks issuer accreditation chain on-chain
- verifier optionally validates a ZKP bound to the claim or presentation
- verifier receives a final trust decision with explanation

Without that, the system remains mostly an issuance and storage architecture.

### 10.6 Priority 5: align the wallet with the real architecture

The wallet should evolve from a local Veramo demo into a holder application for the actual thesis system.

That means:

- importing or receiving chain-backed credentials
- checking remote/on-chain status, not just local JWT validity
- supporting presentation requests
- integrating ZKP generation from held claims or claim-derived data
- removing hardcoded secrets

### 10.7 Priority 6: make the prototype honest about what is centralized

This is important academically.

You do not need to eliminate all centralization in a bachelor thesis. You do need to be precise about where it remains.

Be explicit about:

- central signer assumptions
- service-hosted APIs
- local Hardhat network limitations
- demo-only shortcuts
- missing multi-party governance infrastructure

That honesty will make the thesis stronger, not weaker.

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

- contract/service drift must be fixed first
- wallet/backend identity consistency must be resolved
- verification/presentation flows still need real implementation
- governance details need tightening if you want to make strong decentralization claims

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

1. Fix contract/service compatibility.
2. Finalize one consistent DID flow.
3. Implement one end-to-end verification scenario.
4. Integrate one ZKP-backed claim verification scenario.
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

- weak root-governance enforcement
- centralized key and service control
- DID method inconsistency between wallet and backend
- incomplete verification/presentation flows
- contract/service interface drift in the credential path

My final assessment is:

- Concept quality: high
- Current implementation coherence: medium
- Decentralization fidelity: medium-low
- Thesis feasibility: high if scope is narrowed and integration issues are fixed
- Production feasibility: low in the current state

## 14. Priority Action List

If you want the highest return on effort, do these in order:

1. Fix the smart contract and .NET credential service mismatch.
2. Decide and document the DID method strategy across wallet, backend, and institutions.
3. Implement one real end-to-end verification flow.
4. Tighten EURootAuthority governance and bootstrap logic.
5. Remove or clearly isolate demo-only centralization shortcuts, especially raw private key handling.
6. Integrate the wallet with chain-backed credential status checks and proof presentation.
7. Present unsupported features as future work instead of partially implemented promises.

If those seven items are handled, the project becomes much more coherent, much easier to defend in front of a committee, and much more convincing as a blockchain/DID thesis.