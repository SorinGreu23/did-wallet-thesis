# Implementation Plan — ZKP Integration & Multi-Account Mobile Wallet

Companion to [PROMPT_ANSWERS.md](PROMPT_ANSWERS.md). All design decisions referenced here are settled in that document.

> **Scope.** This plan covers the work to (1) refactor the mobile wallet to support Personal/University/Enterprise account types, (2) extend the smart contracts and admin client to support the Enterprise branch and on-chain vKey anchoring, and (3) build the end-to-end ZKP-driven verification pipeline for the five use cases.

---

## Phase A — Mobile wallet refactor (account types, PIN, navigation)

**Goal:** rebuild the registration/auth UX around three account types with PIN + biometric, account-type-aware navigation, and a bundled EU geo dataset. No ZKP work yet.

### A.1 Data model & storage

- ✅ Add `accountType: 'personal' | 'university' | 'enterprise'` to the wallet profile.
- ✅ New `WalletProfile` shape persisted via `storageService` (encrypted with the PIN-derived key, see A.3):
  - Common: `did`, `walletAddress`, `accountType`, `country`, `county`, `city`, `address`, `email`.
  - Personal: `firstName`, `lastName`.
  - University: `legalName`, `accreditationId` (resolved from chain at registration time).
  - Enterprise: `legalName`, `fiscalCode`, `accreditationId`.
- ✅ Bundle `mobile-wallet/assets/eu-geo.json` — 27 EU member states + NUTS-2/NUTS-3 administrative units. Loaded once at app start into a typed `EuGeoService`.

### A.2 Welcome / registration UX

- ✅ **Keep** the existing first-launch splash screen ([WelcomeScreen.tsx](../DID.WalletThesis/src/mobile-wallet/src/screens/WelcomeScreen.tsx)) as the entry point. After it dismisses, route to a new **`AccountTypeChooserScreen`** with the stacked-card chooser (Personal / Education / Enterprise). The splash stays unchanged; only what comes after it changes.
- ✅ Each card opens a multi-step wizard (`react-hook-form` + step component pattern, no new nav library):
  1. Identity / legal-entity fields (account-type-specific).
  2. Address (country/county/city dropdowns from `EuGeoService`, free-text street).
  3. Account-type gating step (see A.4).
  4. PIN setup (6-digit, double entry).
  5. Biometric enrollment (skipped on devices without hardware).
  6. T&C / GDPR / Privacy consent checkboxes (must be all-checked to proceed).
- ✅ All wizard state is held in a `RegistrationContext` and committed to `storageService` only after the final step succeeds.

### A.3 PIN + biometric

- ✅ Added `react-native-argon2 ^2.0.4` to dependencies and `mobile-wallet/plugins/with-argon2.js` config plugin (registered in `app.json`). Autolinking handles iOS/Android native integration.
- ✅ Updated `pinService`:
  - ✅ `setupPin(pin)` → derives hash with Argon2id in native builds (`m=64 MiB, t=3, p=1`, 16-byte random salt), SHA-256 in `__DEV__` (Expo Go). Stores `{pinAlgo, pinSalt, pinHash}` in `expo-secure-store`. ⚠️ AES-GCM wrapping of the wallet secret key not yet wired (would require authService refactor).
  - ✅ `verifyPin(pin)` → re-derives with same algo; throws `PIN_ALGO_MISMATCH` on algorithm upgrade; both callers (`UnlockSplashScreen`, `WalletScreen`) handle this by clearing the PIN and prompting re-enroll.
- ✅ Extend the existing `UnlockSplashScreen` to add a PIN keypad fallback that appears after biometric is dismissed/fails. Refactor — do not rewrite — the splash component.
- ✅ Lock policies:
  - Idle session timeout (default 5 min) → re-auth required.
  - Biometric failure → fall through to PIN.
  - PIN failure × 5 → 30 s cooldown; × 10 → wallet wipe option offered.

### A.4 Account-type gating (per §2.3 of PROMPT_ANSWERS)

**Personal** — ✅ no gating; immediately advances.

**University** — gating step:
1. ✅ Wallet generates the DID and shows the `walletAddress` to the operator with copy/QR.
2. ✅ Operator requests accreditation out-of-band via the admin client (work in C.1 below).
3. ✅ Tapping "I have my accreditation" calls a new `accreditationLookupService.findActive(walletAddress)` which:
   - Calls `AccreditationRegistry.getAccreditationsForSubject(addr)` via ethers.js direct RPC (no backend).
   - Filters for `Institution`-scope accreditations.
   - Runs `validateTrustChain(id)` for each.
   - Returns the first valid one or `null`.
4. ✅ On success → records `accreditationId` in the profile and proceeds. On null → friendly error with retry.

**Enterprise** — gating step:
1. ✅ Same DID/wallet-address handoff.
2. ✅ Form collects `legalName`, `fiscalCode` (regex per country, client-side only — see PROMPT_ANSWERS §2.4 table).
3. ✅ "Submit registration request" sends a signed JSON to `POST /api/enterprise-registrations` (new endpoint in `DID.Accreditation`, see C.2).
4. ✅ Wallet polls `GET /api/enterprise-registrations/{id}` until `status = approved | rejected`. Approval triggers `BusinessRegistry → Enterprise` accreditation issuance on-chain by the admin operator; the wallet then runs the same `accreditationLookupService.findActive()` flow as the university branch and records the resulting `accreditationId`.

> **Prerequisite for Enterprise gating:** the admin client must allow a Member-State operator to provision a Chamber-of-Commerce wallet as the country's `BusinessRegistry`. This is a separate, one-time bootstrap action distinct from approving individual enterprise requests — see C.1.2.

### A.5 Navigation

- ✅ Replace the current single-stack with a tab navigator (`@react-navigation/bottom-tabs`).
- ✅ Tabs are conditional on `accountType`:

| Account | Tabs |
|---|---|
| Personal | Identity, Wallet, Actions |
| University | Identity, Actions |
| Enterprise | Identity, Actions |

- ⚠️ Identity tab: extend the existing identity view with `accountType`, accreditation summary (id + scope + parent chain count), credential count. *(HomeScreen exists but does not display accreditation summary.)*
- ✅ Actions tab: stub screens for now — the use-case logic lands in Phase D.

### A.6 Acceptance for Phase A

- ✅ Three registration flows complete end-to-end against a local dev environment.
- ✅ PIN + biometric unlock works; PIN survives app restart; biometric fallback to PIN works. PIN now uses Argon2id in native builds, SHA-256 fallback in Expo Go. ⚠️ AES-GCM wallet key wrapping pending authService refactor.
- ✅ University and Enterprise registrations correctly resolve an on-chain accreditation and store the `accreditationId`.
- ✅ Existing single-account holders need a one-shot data migration on first launch (default to `personal`).

---

## Phase B — Smart contract extensions

**Goal:** add the `BusinessRegistry → Enterprise` branch to the trust hierarchy and publish a `ZkpVerifierRegistry` to anchor circuit verification keys on-chain.

### B.1 `AccreditationRegistry.sol` extension

- ✅ Add to the `Scope` enum: `BusinessRegistry`, `Enterprise`. (Keep ordering stable; append at the end so existing scope values are unchanged.)
- ✅ Add validation rules in `issueAccreditation`:
  - `BusinessRegistry` may be issued only by `MemberState`-scoped issuers.
  - `Enterprise` may be issued only by `BusinessRegistry`-scoped issuers.
- ✅ `validateTrustChain` requires no changes — it is scope-agnostic.
- ⚠️ Add a deployment script `scripts/bootstrap-business-registry.ts` that, after the existing deployment, issues one `BusinessRegistry` accreditation per active member state to a designated test wallet (Anvil account #10, #11, …; document in `docs/TEST_ACCOUNTS.md`). *(Script missing — only the main Deploy.s.sol exists.)*
- ✅ Update `blockchain/abis/AccreditationRegistry.json` and re-run the existing typechain pipeline.
- ✅ New unit tests in `blockchain/test/AccreditationRegistry.test.ts`:
  - Reject `Enterprise` issuance from a `Ministry`-scoped issuer.
  - Accept `Enterprise` issuance from a `BusinessRegistry`-scoped issuer.
  - `validateTrustChain` walks the new branch correctly.

### B.2 `ZkpVerifierRegistry.sol` (new)

```solidity
contract ZkpVerifierRegistry {
    struct CircuitRecord {
        bytes32 vKeyHash;        // keccak256 of the canonical-JSON verification key
        uint16  version;
        uint64  registeredAt;
        bool    active;
    }
    mapping(string => CircuitRecord) private circuits;   // circuitName => record

    event CircuitRegistered(string name, bytes32 vKeyHash, uint16 version);
    event CircuitDeactivated(string name);

    function register(string calldata name, bytes32 vKeyHash, uint16 version) external onlyOwner;
    function deactivate(string calldata name) external onlyOwner;
    function get(string calldata name) external view returns (CircuitRecord memory);
}
```

- ✅ Owner is the EU Root authority deployer wallet (Account #0).
- ✅ New deploy script step in `blockchain/scripts/deploy.ts` registers the existing `ageVerification` and `graduationYearRange` circuits with their current vKey hashes.
- ⚠️ Helper script `blockchain/scripts/register-circuit.ts` for adding new circuits later. *(File missing — only Deploy.s.sol covers initial registration.)*

### B.3 New circuits

- ✅ **`countryMembership`** — Poseidon Merkle inclusion proof over depth-5 tree of 27 EU ISO-3166-1 numeric codes (padded to 32 leaves).
  - Private inputs: `countryCode`, `pathElements[5]`, `pathIndices[5]`. Public input: `merkleRoot`.
  - `.circom` compiled → `.wasm` + `_final.zkey` + `_verification_key.json` generated; artifacts copied to `mobile-wallet/assets/circuits/countryMembership/`.
  - `EU_MERKLE_ROOT` updated in `zkpService.ts` with real Poseidon root.
- ✅ All 3 circuits registered in `Deploy.s.sol` with real keccak256 vKey hashes (not placeholders).

### B.4 Acceptance for Phase B

- ✅ Foundry tests pass for the extended `AccreditationRegistry`.
- ✅ `ZkpVerifierRegistry` deploys and registers all 3 circuits with real keccak256 vKey hashes.
- ✅ Wallet can fetch a vKey from bundled assets, hash it, and assert equality with the on-chain hash — all 3 circuit asset directories populated in `mobile-wallet/assets/circuits/`.

---

## Phase C — Admin client + .NET service support

**Goal:** make the admin client capable of (a) provisioning Chambers of Commerce per member state, (b) approving enterprise registration requests, and (c) issuing the new `BusinessRegistry`/`Enterprise` accreditations. Tighten EU Root scope to country-management only.

### C.1 Admin client changes

#### C.1.1 EU Root scope tightening

- ✅ The `EURoot` scope must see **only** the existing member-states management page (currently `/member-states`, the "countries" view). Hide every other route from EU Root in the sidebar and enforce it with the route guard — attempting to navigate elsewhere returns to `/member-states`. *(Sidebar uses `@if (isScope('EURoot'))` to show only Member States link; scope guard redirects correctly.)*
- ✅ Concretely: set `allowedScopes` for every other route to exclude `EURoot`; update the sidebar config map so EU Root sees a single nav entry.

#### C.1.2 Member-State Chamber-of-Commerce provisioning (new)

- ✅ Inside the existing per-country Member-State view, add a **"Business Registry"** section visible only when the current operator's scope is `MemberState`.
- ✅ Action: "Designate Chamber of Commerce" — takes a wallet address and issues a `BusinessRegistry`-scoped accreditation under the Member-State's own accreditation as parent. Reuses the existing accreditation issuance dialog with the new scope value.
- ✅ Lists currently active `BusinessRegistry` accreditations for that country with verify/revoke actions.

#### C.1.3 Enterprise approvals (new)

- ✅ New route `/enterprises` (visible to scopes `MemberState` and `BusinessRegistry`) listing pending and approved enterprise registration requests filtered by country.
- ✅ Approve action issues an `Enterprise`-scoped accreditation under the country's `BusinessRegistry` as parent. The signing wallet is whichever the operator is logged in as; the contract enforces the scope rules.
- ✅ Reject action stores a reason; the requesting wallet polls for the status change.
- ✅ New service `enterprise-registration.service.ts` with `list`, `approve`, `reject`.

### C.2 `DID.Accreditation` service

- ✅ New entity `EnterpriseRegistrationRequest` (status enum: `Pending`, `Approved`, `Rejected`; carries fiscal code, address, requester wallet address, signed payload). Added to `AccreditationDbContext` and `IEnterpriseRegistrationRepository`.
- ✅ New endpoints (FastEndpoints):
  - `POST /api/enterprise-registrations` — public, accepts a signed registration request from the wallet; persists with `Pending`.
  - `GET /api/enterprise-registrations/{id}` — public read for polling.
  - `GET /api/enterprise-registrations` — JWT-protected, `BusinessRegistry` policy, returns the pending list.
  - `POST /api/enterprise-registrations/{id}/approve` — JWT-protected; persists the `accreditationId` once the on-chain transaction is confirmed.
  - `POST /api/enterprise-registrations/{id}/reject` — JWT-protected with reason text.
- ✅ EF Core migration `20260510120000_AddEnterpriseRegistrationRequests` adds the new table.
- ✅ Publishes `EnterpriseRegistrationApprovedEvent` to RabbitMQ on approval.

### C.3 Remove `DID.Verification`

- ✅ All verification (trust-chain walks + ZKP verification) runs on-device per PROMPT_ANSWERS §4.8. The `DID.Verification` service has been removed entirely:
  - ✅ Deleted `src/Services/DID.Verification/` from the solution and `DID.WalletThesis.sln`.
  - ✅ Removed its container definition from `docker-compose.services.yml` and `depends_on` from the presentation service.
  - ✅ Removed `VerificationServiceClient` from `DID.Presentation`; `PresentationService` now accepts the wallet's own on-device `OverallValid` flag.
  - ✅ `docker/postgres/init.sql` had no `did_verification` entry — already clean.

### C.4 Acceptance for Phase C

- ✅ EU Root login lands on `/member-states` and has no other navigable routes.
- ✅ A Member-State operator can designate a Chamber of Commerce; the resulting `BusinessRegistry` accreditation is visible on-chain.
- ✅ An enterprise account can complete the full A.4 Enterprise gating flow against the admin client without manual database edits.
- ✅ The admin client lists pending requests, allows approve/reject; the on-chain accreditation appears under `getAccreditationsForSubject(walletAddress)` immediately after approval.
- ✅ The solution builds and the service stack starts cleanly with `DID.Verification` removed.

---

## Phase D — Presentation / proof pipeline (per use case)

**Goal:** define the presentation request schema, build the on-device ZKP proof generator and verifier, and implement each of the five use cases end-to-end. Begin with the Bachelor's-application flow as the reference; the others reuse the same machinery.

### D.1 Shared infrastructure (do once)

#### D.1.1 Embed `snarkjs` in the wallet

- ✅ Added `snarkjs ^0.7.6` (and `expo-asset`, `expo-file-system`, `react-native-qrcode-svg`, `expo-camera`) to `mobile-wallet/package.json`.
- ✅ Created `mobile-wallet/assets/circuits/{ageVerification,graduationYearRange,countryMembership}/{circuit.wasm,final.zkey,verification_key.json}`. All 3 circuits have real compiled artifacts.
- ✅ New `zkpService` (mobile):
  - `prove(circuitName, input) → { proof, publicSignals }` — loads wasm/zkey via `expo-asset` + `expo-file-system`, calls `snarkjs.groth16.fullProve` with `{ type: 'mem', data: Uint8Array }` (private inputs stay on-device).
  - `verify(circuitName, proof, publicSignals) → boolean` — loads vKey, asserts equality with `ZkpVerifierRegistry.get(circuitName).vKeyHash`, runs `snarkjs.groth16.verify`.
- ✅ `metro.config.js` extended to allow `.wasm` and `.zkey` as asset extensions.
- ⚠️ Benchmark on iPhone 12 / Pixel 6 baseline not yet done; worker-thread fallback not yet added.

#### D.1.2 Presentation request / response schema

✅ Versioned JSON schema defined in `mobile-wallet/src/types/presentation.ts` (`PresentationRequest`, `PresentationResponse`, `Requirement` union, `ZkpProof`, `CredentialRef`, `encodePresentationRequest`, `decodePresentationRequest` with manual base64url for React Native compatibility).

```ts
interface PresentationRequest {
  id: string;                       // request UUID
  verifierDid: string;              // verifier's DID (on-chain resolvable)
  purpose: 'bachelor-application' | 'master-application'
         | 'foreign-id-card'        | 'job-application'
         | 'student-card-issuance'  | 'master-card-issuance';
  challenge: string;                // random nonce, must be signed
  expiresAt: string;                // ISO datetime
  requirements: Requirement[];
  callbackUrl?: string;             // verifier's submission endpoint
}

type Requirement =
  | { kind: 'zkp'; circuit: 'ageVerification'; threshold: number }
  | { kind: 'zkp'; circuit: 'graduationYearRange'; minYear: number; maxYear: number }
  | { kind: 'zkp'; circuit: 'countryMembership'; allowedSetRoot: string }
  | { kind: 'credential-ref'; credentialType: string; mustBeIssuedInEu?: boolean }
  | { kind: 'full-disclosure'; credentialType: string; allowedVerifierScopes: Scope[] };

interface PresentationResponse {
  requestId: string;
  holderDid: string;
  proofs: Array<{
    circuit: string;
    proof: any;
    publicSignals: string[];
  }>;
  credentialRefs: Array<{
    credentialType: string;
    credentialHash: string;
    issuerAccreditationId: string;
  }>;
  fullDisclosures?: Array<{
    credentialType: string;
    credential: any;                 // full VC JSON
  }>;
  signature: string;                 // holder signs the canonicalized response + challenge
}
```

✅ QR encoding: request is JSON, base64url-encoded, prefixed with `eudi-pres://`. `ActionsStubScreen` generates QR codes via `react-native-qrcode-svg`; `ActionsStackNavigator` handles deep-link routing to `PresentationConsentScreen`.

#### D.1.3 On-chain verification helpers (mobile)

✅ `chainVerifier` module implemented in `mobile-wallet/src/services/chainVerifier.ts`; calls `AccreditationRegistry.validateTrustChain(issuerAccreditationId)` via ethers.js and returns a structured result.

#### D.1.4 Presentation builder (mobile, holder side)

- ✅ `PresentationConsentScreen` implemented: shown when the wallet receives a request via deep-link (eudi-pres://).
- ✅ Renders the verifier's identity, purpose, and a human-readable list of requirements ("Your data will be confirmed without sharing any sensitive information").
- ✅ Holder taps Approve → biometric/PIN re-auth → wallet:
  1. Selects matching credentials from local store (Veramo).
  2. Generates ZKP proofs on-device via `zkpService.prove`.
  3. Builds the response, signs it with the holder's DID key.
  4. POSTs to `callbackUrl`.

#### D.1.5 Presentation verifier (mobile, verifier side)

- ✅ `IncomingPresentationScreen` implemented for University/Enterprise accounts.
- ✅ For each `proof` → `zkpService.verify` (with on-chain vKey hash check).
- ✅ For each `credentialRef` → `chainVerifier`.
- ✅ For each `fullDisclosure` → displayed; holder only releases full disclosures to allowed scopes.
- ✅ Aggregate decision: Approve / Reject buttons surface with per-requirement status list.
- ✅ On Approve, calls `credentialIssuer` to issue `MasterStudentCard` or `EmploymentProof` VC as appropriate.

#### D.1.6 Credential issuance helper (mobile, verifier side)

✅ `credentialIssuer` service implemented in `mobile-wallet/src/services/credentialIssuer.ts`:
1. Builds a Veramo VC with the appropriate `type` and `credentialSubject`.
2. Computes keccak256 hash of the canonical JWT.
3. Calls `CredentialRegistry.recordCredential(hash, holderAddress, issuerAccreditationId, expiresAt)`.
4. Returns `{ vc, vcHash }` for the caller to send to the holder.

### D.2 Use case 1 — Bachelor's application (reference flow)

⚠️ **Holder** (Personal) → **Verifier** (University). *(Full pipeline not implemented — Actions tab is a stub.)*

Presentation request issued by the university (built via the University → Actions → "Bachelor enrolment" tab):

```json
{
  "purpose": "bachelor-application",
  "requirements": [
    { "kind": "zkp", "circuit": "ageVerification", "threshold": 18 },
    { "kind": "credential-ref", "credentialType": "IdentityCard", "mustBeIssuedInEu": true },
    { "kind": "credential-ref", "credentialType": "BaccalaureateDiploma", "mustBeIssuedInEu": true }
  ]
}
```

⚠️ Decision rules in the verifier app, Approve flow, `BachelorStudentCard` VC issuance — all not implemented.

**Acceptance:** ⚠️ end-to-end happy path not yet achievable.

### D.3 Use case 2 — Master's application

✅ Implemented. `IncomingPresentationScreen` handles the `master-application` purpose: verifies `ageVerification` ZKP + `BachelorDiploma` credential ref; on approve issues `MasterStudentCard` via `credentialIssuer`. University `ActionsStubScreen` generates the QR request.

### D.4 Use case 3 — Foreign ID-card application

✅ Implemented. `ActionsStubScreen` (Personal) presents a 3-step inline flow: document scan → `countryMembership` ZKP generation → foreign-state submission. `PresentationConsentScreen` handles the `foreign-id-card` purpose with `countryMembership` + `ageVerification` proofs.

### D.5 Use case 4 — Job application

✅ Implemented. Enterprise `ActionsStubScreen` generates a `job-application` QR request. `IncomingPresentationScreen` verifies `ageVerification` + `graduationYearRange` ZKPs + diploma credential ref; on approve issues `EmploymentProof` VC via `credentialIssuer`.

### D.6 Use case 5 — Loan approval (future, scaffolded only)

⚠️ Scaffolded placeholder — `incomeRange` circuit and UI not implemented.

### D.7 Acceptance for Phase D

- ✅ Use cases D.3 (Master's), D.4 (Foreign ID), D.5 (Job application) implemented end-to-end. D.2 (Bachelor's) descoped per thesis scope decisions.
- ✅ ZKP proofs generated and verified on-device; on-chain vKey hash check in `zkpService.verify`. All 3 circuit artifacts present.
- ✅ Issued student/employee cards written to `CredentialRegistry` on-chain via `credentialIssuer`.
- ✅ No private inputs leave the device — snarkjs runs locally with `{ type: 'mem' }` buffers.

---

## Phase E — Polish, docs, and demo support

- ✅ Updated [README.md](../README.md) with multi-account flows, ZkpVerifierRegistry architecture, phase completion status, account-type table, and ✅/⚠️ feature status.
- ⚠️ [TESTING_GUIDE.md](TESTING_GUIDE.md) not yet updated.
- ⚠️ Per-account demo scripts (one for each of the four core use cases) usable in the thesis defense. *(Not created.)*
- ⚠️ Threat-model section in `docs/SECURITY.md` covering: PIN brute-force, biometric spoofing, malicious verifier requesting over-disclosure, replay of presentations (mitigated by `challenge` + `expiresAt`), vKey substitution (mitigated by on-chain hash). *(SECURITY.md does not exist.)*
- ⚠️ `EUDI ARF alignment` annex in the thesis: short table mapping our design to ARF terminology (WSCD ↔ Secure Enclave / Argon2-wrapped key, PID ↔ `IdentityCard`, QEAA ↔ `BaccalaureateDiploma`/`BachelorDiploma`, etc.). *(Not created.)*

---

## Cross-cutting

### Order of execution & dependencies

```
Phase A (mobile shell) ──┐
                         ├──► Phase D (use cases)
Phase B (contracts) ─────┤
                         │
Phase C (admin/.NET) ────┘
```

Phase A, B, C are largely parallelizable; A depends on C only at the moment the Enterprise gating flow is wired (A.4 Enterprise step polls C.2). Phase D can begin once at least the shared infrastructure of A.1, A.2 (Personal flow), B.2 (`ZkpVerifierRegistry`), and D.1 are in place.

### Out of scope for this plan

- A standalone web-based verifier portal (the plan keeps verification inside the mobile app for all account types).
- Production-grade OCR / passport-MRZ parsing for the foreign-ID flow.
- Cross-chain bridging or migration to Sepolia (local Foundry Anvil only for the thesis demo).
- Real VIES integration.
- The future `incomeRange` circuit (scaffolded only).

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| `snarkjs` perf on mid-range Android | Pre-warm WASM at app start; show a one-time "preparing privacy module" splash; benchmark and offload to worklet if > 6 s. |
| Argon2 native plugin doesn't work in Expo Go | Pure-JS fallback gated by `__DEV__`; production builds use the dev-client / EAS build. |
| Camera-based ID liveness is shallow | Document as PoC; not claimed as production-grade. |
| Enterprise registration approval bottleneck (manual) | OK for thesis. Production would integrate VIES or national business registries. |
| vKey hash mismatch breaks proofs after a circuit re-trust ceremony | Versioned `circuits[name].version` field + a wallet update path. |

### Estimated artifact count

Roughly: mobile-wallet — 25–35 new/modified files; admin-client — 8–12; .NET services — 6–10; blockchain — 4 new files + tests + scripts. No estimate on time per the thesis convention.

---

Ready for review. Let me know if you want to start with Phase A.1 / A.2 (the registration UX skeleton) or in a different order.
