# Implementation Plan — ZKP Integration & Multi-Account Mobile Wallet

Companion to [PROMPT_ANSWERS.md](PROMPT_ANSWERS.md). All design decisions referenced here are settled in that document.

> **Scope.** This plan covers the work to (1) refactor the mobile wallet to support Personal/University/Enterprise account types, (2) extend the smart contracts and admin client to support the Enterprise branch and on-chain vKey anchoring, and (3) build the end-to-end ZKP-driven verification pipeline for the five use cases.

---

## Phase A — Mobile wallet refactor (account types, PIN, navigation)

**Goal:** rebuild the registration/auth UX around three account types with PIN + biometric, account-type-aware navigation, and a bundled EU geo dataset. No ZKP work yet.

### A.1 Data model & storage

- Add `accountType: 'personal' | 'university' | 'enterprise'` to the wallet profile.
- New `WalletProfile` shape persisted via `storageService` (encrypted with the PIN-derived key, see A.3):
  - Common: `did`, `walletAddress`, `accountType`, `country`, `county`, `city`, `address`, `email`.
  - Personal: `firstName`, `lastName`.
  - University: `legalName`, `accreditationId` (resolved from chain at registration time).
  - Enterprise: `legalName`, `fiscalCode`, `accreditationId`.
- Bundle `mobile-wallet/assets/eu-geo.json` — 27 EU member states + NUTS-2/NUTS-3 administrative units. Loaded once at app start into a typed `EuGeoService`.

### A.2 Welcome / registration UX

- **Keep** the existing first-launch splash screen ([WelcomeScreen.tsx](mobile-wallet/src/screens/WelcomeScreen.tsx)) as the entry point. After it dismisses, route to a new **`AccountTypeChooserScreen`** with the stacked-card chooser (Personal / Education / Enterprise). The splash stays unchanged; only what comes after it changes.
- Each card opens a multi-step wizard (`react-hook-form` + step component pattern, no new nav library):
  1. Identity / legal-entity fields (account-type-specific).
  2. Address (country/county/city dropdowns from `EuGeoService`, free-text street).
  3. Account-type gating step (see A.4).
  4. PIN setup (6-digit, double entry).
  5. Biometric enrollment (skipped on devices without hardware).
  6. T&C / GDPR / Privacy consent checkboxes (must be all-checked to proceed).
- All wizard state is held in a `RegistrationContext` and committed to `storageService` only after the final step succeeds.

### A.3 PIN + biometric

- Add `react-native-argon2` via an Expo config plugin (`mobile-wallet/plugins/with-argon2.js`). For Expo Go development we ship a pure-JS Argon2 fallback gated by `__DEV__`.
- New `pinService` module:
  - `setupPin(pin)` → derives a 32-byte key with Argon2id (`m=64 MiB, t=3, p=1`, salt = 16 random bytes from `expo-crypto`); wraps the wallet secret key with AES-GCM and stores `{salt, nonce, wrappedKey}` in `expo-secure-store`.
  - `unlockWithPin(pin)` → re-derives, decrypts, returns the secret key. Wrong-PIN counter persisted; lockout after N failures.
- Extend the existing `UnlockSplashScreen` to add a PIN keypad fallback that appears after biometric is dismissed/fails. Refactor — do not rewrite — the splash component.
- Lock policies:
  - Idle session timeout (default 5 min) → re-auth required.
  - Biometric failure → fall through to PIN.
  - PIN failure × 5 → 30 s cooldown; × 10 → wallet wipe option offered.

### A.4 Account-type gating (per §2.3 of PROMPT_ANSWERS)

**Personal** — no gating; immediately advances.

**University** — gating step:
1. Wallet generates the DID and shows the `walletAddress` to the operator with copy/QR.
2. Operator requests accreditation out-of-band via the admin client (work in C.1 below).
3. Tapping "I have my accreditation" calls a new `accreditationLookupService.findActive(walletAddress)` which:
   - Calls `AccreditationRegistry.getAccreditationsForSubject(addr)` via ethers.js direct RPC (no backend).
   - Filters for `Institution`-scope accreditations.
   - Runs `validateTrustChain(id)` for each.
   - Returns the first valid one or `null`.
4. On success → records `accreditationId` in the profile and proceeds. On null → friendly error with retry.

**Enterprise** — gating step:
1. Same DID/wallet-address handoff.
2. Form collects `legalName`, `fiscalCode` (regex per country, client-side only — see PROMPT_ANSWERS §2.4 table).
3. "Submit registration request" sends a signed JSON to `POST /api/enterprise-registrations` (new endpoint in `DID.Accreditation`, see C.2).
4. Wallet polls `GET /api/enterprise-registrations/{id}` until `status = approved | rejected`. Approval triggers `BusinessRegistry → Enterprise` accreditation issuance on-chain by the admin operator; the wallet then runs the same `accreditationLookupService.findActive()` flow as the university branch and records the resulting `accreditationId`.

> **Prerequisite for Enterprise gating:** the admin client must allow a Member-State operator to provision a Chamber-of-Commerce wallet as the country's `BusinessRegistry`. This is a separate, one-time bootstrap action distinct from approving individual enterprise requests — see C.1.2.

### A.5 Navigation

- Replace the current single-stack with a tab navigator (`@react-navigation/bottom-tabs`).
- Tabs are conditional on `accountType`:

| Account | Tabs |
|---|---|
| Personal | Identity, Wallet, Actions |
| University | Identity, Actions |
| Enterprise | Identity, Actions |

- Identity tab: extend the existing identity view with `accountType`, accreditation summary (id + scope + parent chain count), credential count.
- Actions tab: stub screens for now — the use-case logic lands in Phase D.

### A.6 Acceptance for Phase A

- Three registration flows complete end-to-end against a local dev environment.
- PIN + biometric unlock works; PIN survives app restart; biometric fallback to PIN works.
- University and Enterprise registrations correctly resolve an on-chain accreditation and store the `accreditationId`.
- Existing single-account holders need a one-shot data migration on first launch (default to `personal`).

---

## Phase B — Smart contract extensions

**Goal:** add the `BusinessRegistry → Enterprise` branch to the trust hierarchy and publish a `ZkpVerifierRegistry` to anchor circuit verification keys on-chain.

### B.1 `AccreditationRegistry.sol` extension

- Add to the `Scope` enum: `BusinessRegistry`, `Enterprise`. (Keep ordering stable; append at the end so existing scope values are unchanged.)
- Add validation rules in `issueAccreditation`:
  - `BusinessRegistry` may be issued only by `MemberState`-scoped issuers.
  - `Enterprise` may be issued only by `BusinessRegistry`-scoped issuers.
- `validateTrustChain` requires no changes — it is scope-agnostic.
- Add a deployment script `scripts/bootstrap-business-registry.ts` that, after the existing deployment, issues one `BusinessRegistry` accreditation per active member state to a designated test wallet (Hardhat account #10, #11, …; document in `docs/HARDHAT_ACCOUNTS.md`).
- Update `blockchain/abis/AccreditationRegistry.json` and re-run the existing typechain pipeline.
- New unit tests in `blockchain/test/AccreditationRegistry.test.ts`:
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

- Owner is the EU Root authority deployer wallet (Account #0).
- New deploy script step in `blockchain/scripts/deploy.ts` registers the existing `ageVerification` and `graduationYearRange` circuits with their current vKey hashes.
- Helper script `blockchain/scripts/register-circuit.ts` for adding new circuits later.

### B.3 New circuits

- **`countryMembership`** — Merkle inclusion proof of a 4-byte country code against a fixed tree of the 27 EU codes.
  - Inputs: private `countryCode`, private `merklePath[5]`, public `merkleRoot`.
  - Compile + ptau ceremony in `zkp-service/src/circuits/countryMembership/`.
- Register both new and existing circuits in `ZkpVerifierRegistry` as part of the bootstrap.

### B.4 Acceptance for Phase B

- Hardhat tests pass for the extended `AccreditationRegistry`.
- `ZkpVerifierRegistry` deploys, registers all 3 circuits, returns matching hashes.
- Local end-to-end: a wallet can fetch a vKey from its bundled assets, hash it, and successfully assert equality with the on-chain hash.

---

## Phase C — Admin client + .NET service support

**Goal:** make the admin client capable of (a) provisioning Chambers of Commerce per member state, (b) approving enterprise registration requests, and (c) issuing the new `BusinessRegistry`/`Enterprise` accreditations. Tighten EU Root scope to country-management only.

### C.1 Admin client changes

#### C.1.1 EU Root scope tightening

- The `EURoot` scope must see **only** the existing member-states management page (currently `/member-states`, the "countries" view). Hide every other route from EU Root in the sidebar and enforce it with the route guard — attempting to navigate elsewhere returns to `/member-states`.
- Concretely: set `allowedScopes` for every other route to exclude `EURoot`; update the sidebar config map so EU Root sees a single nav entry.

#### C.1.2 Member-State Chamber-of-Commerce provisioning (new)

- Inside the existing per-country Member-State view, add a **"Business Registry"** section visible only when the current operator's scope is `MemberState`.
- Action: "Designate Chamber of Commerce" — takes a wallet address (or QR scan from the chamber's mobile wallet) and issues a `BusinessRegistry`-scoped accreditation under the Member-State's own accreditation as parent. Reuses the existing accreditation issuance dialog with the new scope value.
- Lists currently active `BusinessRegistry` accreditations for that country with revoke action.

#### C.1.3 Enterprise approvals (new)

- New route `/enterprises` (visible to scopes `MemberState` and `BusinessRegistry`) listing pending and approved enterprise registration requests filtered by country.
- Approve action issues an `Enterprise`-scoped accreditation under the country's `BusinessRegistry` as parent. The signing wallet is whichever the operator is logged in as (Member-State or BusinessRegistry); the contract enforces the scope rules.
- Reject action stores a reason and notifies the requesting wallet via the existing event bus path (or the wallet's polling).
- New service `enterprise-registration.service.ts` with `list`, `approve`, `reject`.

### C.2 `DID.Accreditation` service

- New entity `EnterpriseRegistrationRequest` (status enum: `Pending`, `Approved`, `Rejected`; carries fiscal code, address, requester wallet address, signed payload).
- New endpoints (FastEndpoints):
  - `POST /api/enterprise-registrations` — public, accepts a signed registration request from the wallet. Verifies the signature is from the claimed wallet address; persists with `Pending`.
  - `GET /api/enterprise-registrations/{id}` — public read for polling.
  - `GET /api/enterprise-registrations` — JWT-protected, scopes `MemberState` or `BusinessRegistry`, returns the pending list filtered by the operator's country.
  - `POST /api/enterprise-registrations/{id}/approve` — JWT-protected. The endpoint persists the `accreditationId` once the on-chain transaction (signed by the operator) is confirmed.
  - `POST /api/enterprise-registrations/{id}/reject` — JWT-protected with reason text.
- EF Core migration adds the new table.
- Publish `EnterpriseRegistrationApprovedEvent` to RabbitMQ (consumed by the wallet's existing notification flow if subscribed; otherwise the wallet just polls).

### C.3 Remove `DID.Verification`

- All verification (trust-chain walks + ZKP verification) runs on-device per PROMPT_ANSWERS §4.8. The `DID.Verification` service is no longer in the runtime trust path and is removed entirely:
  - Delete `src/Services/DID.Verification/` from the solution and `DID.WalletThesis.sln`.
  - Remove its container definition from `docker-compose.services.yml`.
  - Drop any client-side `verificationService` calls from the admin client and mobile wallet (replace with direct on-chain reads via ethers.js / Nethereum where any backend caller still needs them — expected to be none).
  - Remove its DB and any references in `docker/postgres/init.sql`.

### C.4 Acceptance for Phase C

- EU Root login lands on `/member-states` and has no other navigable routes.
- A Member-State operator can designate a Chamber of Commerce; the resulting `BusinessRegistry` accreditation is visible on-chain.
- An enterprise account can complete the full A.4 Enterprise gating flow against the admin client without manual database edits.
- The admin client lists pending requests, allows approve/reject; the on-chain accreditation appears under `getAccreditationsForSubject(walletAddress)` immediately after approval.
- The solution builds and the service stack starts cleanly with `DID.Verification` removed.

---

## Phase D — Presentation / proof pipeline (per use case)

**Goal:** define the presentation request schema, build the on-device ZKP proof generator and verifier, and implement each of the five use cases end-to-end. Begin with the Bachelor's-application flow as the reference; the others reuse the same machinery.

### D.1 Shared infrastructure (do once)

#### D.1.1 Embed `snarkjs` in the wallet

- Add `snarkjs` to `mobile-wallet/package.json`.
- Create `mobile-wallet/assets/circuits/{ageVerification,graduationYearRange,countryMembership}/{circuit.wasm,final.zkey,verification_key.json}`.
- New `zkpService` (mobile):
  - `prove(circuitName, input) → { proof, publicSignals }` — loads wasm/zkey via `expo-asset`, calls `snarkjs.groth16.fullProve`.
  - `verify(circuitName, proof, publicSignals) → boolean` — loads vKey, hashes it, asserts equality with `ZkpVerifierRegistry.get(circuitName).vKeyHash`, then runs `snarkjs.groth16.verify`.
  - Hermes polyfills (BigInt is fine on modern Hermes; add `react-native-quick-base64` if needed).
- Benchmark on iPhone 12 / Pixel 6 baseline; if proving exceeds ~6 s per circuit, move it to a worker thread (`react-native-worklets-core`).

#### D.1.2 Presentation request / response schema

Define a versioned JSON schema in `mobile-wallet/src/types/presentation.ts` and mirror it in `DID.Shared.Domain` for the .NET side:

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

QR encoding: the request is JSON, base64url-encoded, prefixed with `eudi-pres://`. Parsed by `expo-camera` + `react-native-qrcode-svg` for generation.

#### D.1.3 On-chain verification helpers (mobile)

A shared `chainVerifier` module: for each `credentialRef`, calls `CredentialRegistry.getCredential(hash)` then `AccreditationRegistry.validateTrustChain(issuerAccreditationId)`. Returns a structured result with the parent chain so verifiers can render it.

#### D.1.4 Presentation builder (mobile, holder side)

- New `PresentationConsentScreen`: shown when the wallet receives a request via QR scan or deep-link.
- Renders the verifier's identity (resolved DID → on-chain accreditation summary), the purpose, and a human-readable list of what will be shared (no jargon — uses the §4.7 "Your data will be confirmed without sharing any sensitive information" copy).
- Holder taps Approve → biometric/PIN re-auth → wallet:
  1. Selects matching credentials from local store (Veramo).
  2. Generates ZKP proofs via `zkpService.prove`.
  3. Builds the response, signs it with the holder's DID key.
  4. POSTs to `callbackUrl` (or returns it via the deep-link's response channel).

#### D.1.5 Presentation verifier (mobile, verifier side)

- New `IncomingPresentationScreen` for University/Enterprise accounts (and the foreign-state flow when re-used on Personal devices acting as verifiers).
- For each `proof` → `zkpService.verify` (with on-chain vKey hash check).
- For each `credentialRef` → `chainVerifier`.
- For each `fullDisclosure` → display + the verifier's scope is implicitly checked because the holder only releases full disclosures to scopes ∈ {`EURoot`, `MemberState`}.
- Aggregate decision: Approve / Reject button surfaces.
- On Approve, if the use case implies issuance of a new credential (student card, employee card), the wallet calls the shared `credentialIssuer` (D.2.6).

#### D.1.6 Credential issuance helper (mobile, verifier side)

For University/Enterprise verifiers issuing back to a holder:
1. Build a Veramo VC with the appropriate `type` and `credentialSubject`.
2. Compute the keccak256 hash of the canonical JWT.
3. Call `CredentialRegistry.recordCredential(hash, holderAddress, issuerAccreditationId, expiresAt)` — succeeds because `validateTrustChain` resolves through `Institution` (university) or `Enterprise` (company).
4. Send the VC JWT to the holder via the callback channel; the holder's wallet stores it via Veramo.

### D.2 Use case 1 — Bachelor's application (reference flow)

**Holder** (Personal) → **Verifier** (University).

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

Decision rules in the verifier app:
- Age proof verifies.
- `IdentityCard` and `BaccalaureateDiploma` resolve through valid trust chains terminating at the EU root.
- Issuer country, derived from the `accreditation.countryCode`, ∈ EU set (or for full privacy use `countryMembership` proof instead).

On Approve → issues `BachelorStudentCard` VC + on-chain hash.

**Acceptance:** end-to-end happy path on local Hardhat with two devices (or one device + a simulator), including the on-chain credential record visible via `CredentialRegistry`.

### D.3 Use case 2 — Master's application

Same shape; difference is the requirement list (`BachelorDiploma` instead of `Baccalaureate`) and the issued `MasterStudentCard`.

### D.4 Use case 3 — Foreign ID-card application

**Holder** (Personal) → **Verifier** (state outside the EU; in the prototype, modelled as a `Personal` device acting in a "Public Sector" verifier mode loaded from the holder's Actions tab).

This use case uses the in-wallet country picker + ID-card capture (decision §5.6):
1. Holder selects destination country in the Actions wizard.
2. Wallet launches a real-time camera capture screen (`expo-camera`) — front side then back side, with a basic on-device liveness check (frame-difference + edge detection; we are not building a production OCR pipeline). Captured images are kept in memory, never persisted.
3. Wallet builds the response with: `ageVerification(threshold=16)` + `IdentityCard` full disclosure (allowed because the verifier is a state, scope ∈ {`EURoot`, `MemberState`}) + the captured images attached.
4. The holder reviews everything and confirms with biometric/PIN.

Verifier side (out-of-scope for thesis — for the demo we use a stub web page or a second mobile-wallet instance set to Public-Sector mode that runs the existing verifier logic).

### D.5 Use case 4 — Job application

**Holder** (Personal) → **Verifier** (Enterprise). Same machinery as Bachelor's application; requirements: `ageVerification(threshold=18)` + `BachelorDiploma` reference + EU-issuer check. On Approve → company issues `EmploymentProof` ("employee card") VC + on-chain hash.

### D.6 Use case 5 — Loan approval (future, scaffolded only)

Documented as a non-shipping placeholder in the wallet to demonstrate composability: requires `IdentityCard`, `EmploymentProof`, and a future `incomeRange` circuit. We will scaffold the requirement list and UI but not implement the circuit unless time permits.

### D.7 Acceptance for Phase D

- All four implemented use cases (D.2, D.3, D.4, D.5) complete on local Hardhat.
- All ZKP proofs verify on-device with on-chain vKey hash check.
- Issued student/employee cards appear in the holder's Wallet tab and in `CredentialRegistry`.
- No private inputs leave the device at any point.

---

## Phase E — Polish, docs, and demo support

- Update [README.md](README.md) and [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) with the multi-account flows.
- Per-account demo scripts (one for each of the four core use cases) usable in the thesis defense.
- Threat-model section in `docs/SECURITY.md` covering: PIN brute-force, biometric spoofing, malicious verifier requesting over-disclosure, replay of presentations (mitigated by `challenge` + `expiresAt`), vKey substitution (mitigated by on-chain hash).
- `EUDI ARF alignment` annex in the thesis: short table mapping our design to ARF terminology (WSCD ↔ Secure Enclave / Argon2-wrapped key, PID ↔ `IdentityCard`, QEAA ↔ `BaccalaureateDiploma`/`BachelorDiploma`, etc.).

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
- Cross-chain bridging or migration to Sepolia (local Hardhat only for the thesis demo).
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
