# Thesis Execution Backlog

Status Legend: `DONE` | `IN PROGRESS` | `NEXT` | `LATER`

This task list is no longer organized around completing all microservices as first-class domain systems.

It is now organized around building the 3-platform thesis prototype:

1. Accreditation Platform
2. Mobile Wallet App
3. Verifier Platform

with:

- blockchain as trust anchor
- ZKP as mandatory privacy mechanism
- EUDI-aligned issuance and presentation direction
- helper services only where they improve UX without owning trust

## Week 1 — March 9 to March 15

Goal: finish the accreditation-platform vertical slice and refactor the mobile wallet foundation.

### Accreditation Platform

- `NEXT` Finalize actor model for demo roles: root demo authority, member state, ministry, institution.
- `NEXT` Finish accreditation issuance flow in the admin UI.
- `NEXT` Finish accreditation listing and filtering UI.
- `NEXT` Finish accreditation detail view with issuer, subject, scope, parent, status, tx hash.
- `NEXT` Finish accreditation revocation flow.
- `NEXT` Finish accreditation verification view showing trust-chain result.
- `NEXT` Add trust-chain visualization for at least one selected accreditation.
- `NEXT` Ensure the demo uses the blockchain-backed accreditation path consistently.

### Mobile Wallet Refactor

- `NEXT` Refactor wallet services into cleaner boundaries: identity, credentials, storage, proof flow.
- `NEXT` Remove or isolate purely demo-only self-issued credential assumptions.
- `NEXT` Decide the short-term wallet identity strategy for the thesis demo.
- `NEXT` Replace hardcoded shortcuts where possible, or explicitly isolate them as temporary dev-only code.
- `NEXT` Prepare wallet state and screen structure for real holder credentials.

### Technical Stabilization

- `NEXT` Verify that the accreditation service path used by the UI matches the deployed contract interface.
- `NEXT` Confirm issuance, resolve, verify, and revoke work end to end on the demo chain.
- `NEXT` Update screenshots and talking points for coordinator demo.

### End-of-Week Deliverable

- a presentable accreditation platform demo
- refactored wallet foundation ready for real credential flows

## Week 2 — March 16 to March 22

Goal: stabilize credential architecture and define the final identity/protocol direction.

- `NEXT` Fix contract / ABI / DTO / service drift in the credential path.
- `NEXT` Freeze the thesis-scope smart contract interfaces.
- `NEXT` Decide final identifier strategy for institutions, holders, and verifier-facing metadata.
- `NEXT` Decide thesis-scope credential format strategy with EUDI alignment in mind.
- `NEXT` Define how on-chain holder binding relates to wallet-facing identity.
- `NEXT` Start extracting a shared client SDK for chain reads and trust-chain verification.

## Week 3 — March 23 to March 29

Goal: make credential issuance wallet-first.

- `NEXT` Move issuer-side credential creation toward wallet-controlled signing.
- `NEXT` Make the holder wallet receive and store real thesis credentials.
- `NEXT` Use shared SDK logic for status lookup and trust-chain lookup.
- `NEXT` Define or begin implementing OpenID4VCI-aligned issuance orchestration.
- `NEXT` Reduce backend dependence for issuer-side signing.

## Week 4 — March 30 to April 5

Goal: start the verifier platform and presentation flow.

- `NEXT` Scaffold verifier platform or verifier-facing module.
- `NEXT` Define verifier request structure.
- `NEXT` Implement QR or challenge-based request flow.
- `NEXT` Implement local signature validation in verifier logic.
- `NEXT` Implement on-chain credential-status check in verifier logic.
- `NEXT` Implement on-chain issuer-accreditation verification in verifier logic.

## Week 5 — April 6 to April 12

Goal: integrate mandatory ZKP in the holder-verifier flow.

- `NEXT` Bind ZKP generation to real wallet-held claims or claim-derived witness data.
- `NEXT` Make wallet produce ZKP-backed limited disclosure for one concrete scenario.
- `NEXT` Make verifier validate the proof alongside trust-chain status.
- `NEXT` Support at least one strong thesis scenario:
  employer diploma eligibility, bank age/eligibility, or university admission eligibility.

## Week 6 — April 13 to April 19

Goal: reduce backend authority and clarify helper-service roles.

- `NEXT` Reframe BlockchainSync as an indexer, not a trust authority.
- `NEXT` Reframe presentation backend logic as broker-only if retained.
- `NEXT` Stop expanding identity/accreditation/credential/verification services as domain authorities.
- `NEXT` Document which services remain optional helper infrastructure.
- `NEXT` Ensure verification remains reproducible without trusting backend cache results.

## Week 7 — April 20 to April 26

Goal: harden the end-to-end thesis prototype.

- `NEXT` Polish accreditation platform UX.
- `NEXT` Polish wallet presentation flow.
- `NEXT` Polish verifier result UX.
- `NEXT` Rehearse the complete demo path.
- `NEXT` Update architecture diagrams and thesis narrative.
- `NEXT` Document limitations honestly: governance scope, EUDI partial implementation, helper-service compromises.

## Week 8 — April 27 to May 3

Goal: buffer, bug fixing, and coordinator/thesis presentation readiness.

- `NEXT` Fix demo blockers.
- `NEXT` Stabilize environment startup instructions.
- `NEXT` Produce screenshots and final diagrams.
- `NEXT` Prepare concise explanation of innovation, decentralization boundary, and standards alignment.

## Refactoring Backlog

These refactors are part of the implementation, not optional cleanup.

### High Priority

- `NEXT` Refactor mobile wallet service boundaries.
- `NEXT` Extract shared client-side chain logic into a reusable SDK.
- `NEXT` Remove backend signing assumptions from issuance flows.
- `NEXT` Remove backend authority assumptions from verification flows.

### Medium Priority

- `LATER` Rename or reframe BlockchainSync as an indexer.
- `LATER` Merge or downgrade backend services that no longer deserve domain-authority status.
- `LATER` Reduce duplicated blockchain logic between services and clients.

## Platform-Specific Definition of Done

### Accreditation Platform

Done means:

- issue accreditation
- revoke accreditation
- verify accreditation
- show trust hierarchy
- show on-chain references
- demo-ready UI narrative

### Mobile Wallet

Done means:

- local key custody
- credential storage
- presentation preparation
- ZKP-backed limited disclosure path
- prepared for real thesis credentials rather than only demo credentials

### Verifier Platform

Done means:

- request proof
- receive presentation
- validate cryptographic artifact
- validate on-chain trust and status
- show eligibility result clearly

## Coordinator Demo Milestone

The next coordinator demo should show:

1. Accreditation platform working end to end.
2. Trust-chain verification visible in the UI.
3. Mobile wallet refactor direction clearly underway.
4. Clear roadmap toward wallet credentials, verifier flow, and mandatory ZKP.

## Thesis-Grade Success Criteria

The prototype is strong enough if it can demonstrate:

1. institutional trust enforced on-chain
2. holder-controlled credentials in the wallet
3. verifier-side eligibility checks without excessive disclosure
4. mandatory ZKP-backed privacy story
5. helper services that improve UX without becoming trust anchors