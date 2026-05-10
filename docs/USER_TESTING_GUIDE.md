# User Testing Guide — ZKP Integration & Multi-Account Wallet

> **Audience:** tester walking through the system end-to-end.
> See [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) for all Anvil private keys and contract addresses.

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Docker Desktop | any recent | infra containers |
| Node.js | 18 + | admin client, zkp-service |
| .NET SDK | 10 | backend services |
| Foundry (`forge`, `cast`) | latest | contract deploy |
| Xcode + iOS Simulator | 15 + | mobile wallet native build |
| Expo CLI | latest | `npx expo run:ios` |

> **⚠️ Expo Go is not enough.** The wallet uses `react-native-argon2` (native PIN hashing) and `snarkjs` WASM provers. You need a **custom dev client** built with `npx expo run:ios`.

---

## 1. Environment Setup

### 1.1 Start infrastructure

```bash
# From repo root
docker compose -f docker-compose.infra.yml up -d
```

Starts: Foundry Anvil (port 8545), PostgreSQL (5432), RabbitMQ (5672 / 15672).

Wait ~10 s, then confirm Anvil is up:

```bash
docker exec did-foundry cast block-number --rpc-url http://localhost:8545
# expected: 0
```

### 1.2 Deploy smart contracts

```bash
# From repo root
docker compose -f docker-compose.infra.yml --profile tools run --rm contract-deployer
```

Expected console output:
```
EURootAuthority:       0x...
AccreditationRegistry: 0x...
CredentialRegistry:    0x...
ZkpVerifierRegistry:   0x...
```

Compare with addresses in [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md). If they differ, update that file.

> Contracts are **persistent** across Anvil restarts as long as the `foundry_data` Docker volume is intact. Re-deploy only after `docker compose ... down -v`.

### 1.3 Start backend services

```bash
# From repo root — builds and starts all .NET services + admin client
docker compose -f docker-compose.services.yml up -d --build
```

This starts: Identity (5259), Accreditation (5211), Credential (5214), Presentation (5217), BlockchainSync, Notification, and the admin client (4200).

All services auto-migrate their PostgreSQL databases on first start. Wait ~30 s, then check all containers are healthy:

```bash
docker compose -f docker-compose.services.yml ps
```

To tail logs for a specific service:

```bash
docker compose -f docker-compose.services.yml logs -f accreditation
```

### 1.4 Open admin client

The admin client is served by Docker at `http://localhost:4200` — no separate step needed.

> If you prefer to run it locally for hot-reload during development:
> ```bash
> cd DID.WalletThesis/src/admin-client
> npm install && npm start
> ```

### 1.5 Build and start mobile wallet (native dev client)

```bash
cd DID.WalletThesis/src/mobile-wallet
npm install
npx expo run:ios
```

First build takes 3–5 minutes (Cocoapods install). Subsequent runs are fast.

> **Note:** `npx expo start` (Expo Go) will work for UI flows but ZKP proving and Argon2 PIN will silently fall back to stubs / SHA-256.

---

## 2. Admin Client — EU Root Flows

### 2.1 Login as EU Root

1. Open `http://localhost:4200` — you are redirected to `/login`.
2. Paste the EU Root private key (no `0x` prefix):
   ```
   ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
3. Click **Sign In with DID-Auth**.
4. **Expected:** redirected to `/member-states`. Sidebar shows **Member States** only (EU Root scope is restricted to this single view).

### 2.2 Issue a Member State accreditation

1. On `/member-states`, click **+ Issue Accreditation**.
2. Fill in:
   - **Name:** `Romania`
   - **Ethereum Address:** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Anvil #1)
3. Click **Issue**. Wait for the blockchain transaction to confirm (~2 s on local Anvil).
4. **Expected:** Romania appears in the list with status `Active` and a transaction hash badge.

### 2.3 Inspect & verify a Member State

1. Click **Inspect** (eye icon) next to Romania.
2. The detail panel shows: AccreditationId, IssuerDID, SubjectDID, Status, Tx hash.
3. Click **Verify**. The system calls `validateTrustChain()` on-chain.
4. **Expected:** green banner — `Trust chain valid. Chain length: 1`.
5. Trust chain display shows: `EU Root → Romania`.

### 2.4 RBAC — EU Root cannot navigate elsewhere

1. Manually navigate to `http://localhost:4200/ministries`.
2. **Expected:** redirected back to `/member-states`. EU Root scope is locked to that page.

---

## 3. Admin Client — Member State Flows

### 3.1 Login as Member State (Romania)

1. Logout (bottom of sidebar).
2. Login with Anvil #1 private key:
   ```
   59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
   ```
3. **Expected:** redirected to `/member-states`. Sidebar shows **Member States**, **Ministries**, **Institutions**, **Enterprises**.

### 3.2 Navigate the hierarchy

#### Issue Ministry accreditation (logged in as Romania — Anvil #1)

1. While still logged in as Romania (`59c6995e...`), click **Romania** in the member states list → navigates to `/ministries`.
2. Click **+ Issue Accreditation**.
3. Fill in:
   - **Name:** `Ministry of Education`
   - **Ethereum Address:** `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (Anvil #2)
4. Click **Issue**. Wait for confirmation. **Expected:** Ministry of Education appears with status `Active`.

#### Issue Institution accreditation (logged in as Ministry — Anvil #2)

5. Logout, then login with the Ministry of Education private key (Anvil #2):
   ```
   5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
   ```
6. Navigate to `/ministries` → click **Ministry of Education** → navigates to `/institutions`.
7. Click **+ Issue Accreditation**.
8. Fill in:
   - **Name:** `Babeș-Bolyai University`
   - **Ethereum Address:** `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (Anvil #3)
9. Click **Issue**. **Expected:** Babeș-Bolyai University appears under Institutions with status `Active`.

### 3.3 Business Registry section (Chamber of Commerce)

> This section is visible only when logged in as a Member State scope.

1. While logged in as Romania (Anvil #1), go to `/member-states`.
2. Scroll down — a **Business Registry** section appears below the Member State list.
3. Click **+ Designate Chamber of Commerce**.
4. Fill in:
   - **Name:** `Romanian Chamber of Commerce` (optional)
   - **Ethereum Address:** `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (Anvil #4)
5. Click **Issue**. Wait for confirmation.
6. **Expected:** Chamber of Commerce appears in the Business Registry list with status `Active`.
7. Click **Inspect** → **Verify** on the Chamber entry.
8. **Expected:** trust chain shows `EU Root → Romania → Romanian Chamber of Commerce`.

### 3.4 Revoke a Business Registry accreditation

1. Click **Inspect** on the Chamber of Commerce entry.
2. Click **Revoke**.
3. **Expected:** status changes to `Revoked`. Re-verify: trust chain returns `Revoked` status.

---

## 4. Admin Client — Enterprise Registration Approvals

> Prerequisite: an active `BusinessRegistry` accreditation exists (complete section 3.3 first, or re-issue after the revoke test).

### 4.1 Login as Business Registry

1. Logout, then login with Anvil #4 private key:
   ```
   47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
   ```
2. **Expected:** redirected to `/enterprises`. Sidebar shows **Enterprises**.

### 4.2 View pending enterprise registrations

1. Navigate to `/enterprises`.
2. Initially the list is empty — enterprise requests come from the mobile wallet (section 7.3).
3. Once a mobile wallet submits a request, it appears here with status `Pending`.

### 4.3 Approve an enterprise registration

1. Click **Approve** on a pending request.
2. A modal asks for the enterprise's Ethereum address (pre-filled from the request).
3. Confirm — the system issues an `Enterprise`-scoped accreditation on-chain.
4. **Expected:** request status changes to `Approved`. The requesting wallet (polling `GET /api/enterprise-registrations/{id}`) detects the approval and resolves its `accreditationId`.

### 4.4 Reject a registration

1. Click **Reject** on a pending request.
2. Enter a rejection reason (e.g. `Invalid fiscal code`).
3. **Expected:** request status changes to `Rejected` with reason visible.

---

## 5. Mobile Wallet — Registration Flows

> All flows below assume the native dev client is running (`npx expo run:ios`).

### 5.1 Fresh install — Welcome screen

1. Launch the app for the first time (or after clearing app data).
2. **Expected:** Welcome screen with logo and **Get Started** button.
3. Tap **Get Started** → **Account Type Chooser** with three cards: Personal, Education, Enterprise.

---

### Flow 1: Personal Account Registration

1. Tap **Personal**.
2. **Step 1 — Identity:** enter First Name `Alice`, Last Name `Test`.
3. **Step 2 — Address:** select Country `Romania`, County, City, street address.
4. **Step 3 — Gating:** none (Personal has no gating). Automatically advances.
5. **Step 4 — PIN Setup:** enter `123456`, confirm `123456`.
6. **Step 5 — Biometric:** if prompted, enroll Face ID / Touch ID (or skip on simulator).
7. **Step 6 — Consent:** check all three boxes (T&C, GDPR, Privacy). Tap **Complete**.
8. **Expected:** navigated to main tab navigator. Three tabs visible: **Identity**, **Wallet**, **Actions**.

### Verify Personal tab behaviour

- **Identity tab:** shows DID, wallet address, account type `Personal`.
- **Wallet tab:** visible (personal account only).
- **Actions tab:** shows paste-request area and placeholder flows.

---

### Flow 2: University Account Registration

> Prerequisite: Anvil #3 (`0x90F79...`) has an active `Institution` accreditation (issued in section 3.2).

1. Tap **Education** on the Account Type Chooser.
2. **Step 1 — Identity:** enter Legal Name `Babeș-Bolyai University`.
3. **Step 2 — Address:** fill as before.
4. **Step 3 — Gating (University):**
   - The screen displays the generated wallet address.
   - Tap **Copy Address** — use this to issue an accreditation in the admin client if not yet done.
   - Tap **I Have My Accreditation**.
   - The wallet calls `AccreditationRegistry.getAccreditationsForSubject(addr)` and `validateTrustChain` on-chain.
   - **Expected:** green confirmation with the resolved `accreditationId`. Advances to PIN step.
5. Complete PIN, Biometric, Consent steps as in Flow 1.
6. **Expected:** main navigator with **two** tabs: **Identity**, **Actions** (no Wallet tab).

---

### Flow 3: Enterprise Account Registration

> Prerequisite: an active `BusinessRegistry` accreditation exists (section 3.3).

1. Tap **Enterprise** on the Account Type Chooser.
2. **Step 1 — Legal entity:** Legal Name `Acme SRL`, Fiscal Code `RO12345678`.
3. **Step 2 — Address:** fill as before.
4. **Step 3 — Gating (Enterprise):**
   - The screen displays the generated wallet address and a **Submit Registration Request** button.
   - Tap **Submit** — the wallet POSTs a signed JSON to `POST /api/enterprise-registrations`.
   - A spinner appears with the message "Waiting for approval…".
   - Switch to the admin client (logged in as Business Registry, section 4.1) and **approve** the request.
   - **Expected:** the mobile wallet detects the approval (polling every few seconds), resolves `accreditationId`, and advances to PIN step.
5. Complete PIN, Biometric, Consent.
6. **Expected:** main navigator with **two** tabs: **Identity**, **Actions** (no Wallet tab).

---

## 6. Mobile Wallet — PIN & Biometric

### 6.1 Lock and unlock with PIN

1. Background the app for 5 minutes (or force-quit and relaunch).
2. **Expected:** Unlock screen appears.
3. Enter correct 6-digit PIN → unlocks.

### 6.2 Wrong PIN lockout

1. On the unlock screen, enter wrong PIN 5 times.
2. **Expected:** 30-second cooldown message.
3. After cooldown, enter wrong PIN 5 more times.
4. **Expected:** "Consider wiping and re-registering" option offered.

### 6.3 Biometric fallback

1. On unlock screen, dismiss biometric prompt.
2. **Expected:** PIN keypad appears automatically.

### 6.4 Argon2id vs SHA-256 (native build only)

- In `npx expo run:ios` builds: PIN is hashed with **Argon2id** (`m=64 MiB, t=3, p=1`).
- In `npx expo start` (Expo Go): PIN falls back to SHA-256.
- If you switch between builds with a pre-existing PIN, the unlock screen shows: *"Security upgrade required. Please re-register your PIN."* The PIN is cleared automatically.

---

## 7. ZKP Presentation Flows

> All ZKP flows require the **native dev client** build. Expo Go will render the screens but WASM proof generation will fail.
>
> These flows require two devices (or two simulators). One acts as the **Holder** (Personal account), the other as the **Verifier** (University or Enterprise account).

---

### Flow A: Master's Application (University ↔ Personal)

**Preconditions:**
- Simulator A: Personal account with a `BachelorDiploma` credential already issued (or use the admin client to issue one manually via `POST /api/credentials`).
- Simulator B: University account (Flow 2 completed, Anvil #3 accredited).

**Steps — Verifier side (Simulator B, University):**
1. Open the **Actions** tab.
2. Tap **Master's Application** → a QR code appears on screen.
   - The QR encodes a `eudi-pres://` URI containing: `purpose: master-application`, requirements `[ageVerification ≥ 18, BachelorDiploma credential-ref]`, challenge nonce, callback URL.

**Steps — Holder side (Simulator A, Personal):**
1. Open the **Actions** tab.
2. Tap **Scan Presentation Request** (or paste the `eudi-pres://` URI).
3. **Expected:** `PresentationConsentScreen` opens showing:
   - Verifier: `Babeș-Bolyai University`
   - Purpose: `Master's application`
   - Requirements listed in plain language: *"Your age will be confirmed without revealing the exact value"* and *"Your bachelor's diploma will be verified"*.
4. Tap **Approve** → biometric/PIN re-auth prompt.
5. After auth, the wallet:
   - Generates an `ageVerification` Groth16 ZKP on-device (expect ~3–8 s).
   - Selects the `BachelorDiploma` credential from Veramo storage.
   - Signs the presentation response.
   - POSTs to the callback URL.
6. **Expected on Holder:** "Presentation submitted successfully."

**Steps — Verifier side (Simulator B):**
1. The `IncomingPresentationScreen` opens automatically when the callback receives the response.
2. **Expected:** each requirement shows a green tick:
   - ✅ `ageVerification` — ZKP verified, on-chain vKey hash matches.
   - ✅ `BachelorDiploma` — trust chain valid.
3. Tap **Approve**.
4. **Expected:** `MasterStudentCard` VC is issued, recorded on-chain in `CredentialRegistry`, and sent back to the holder. Holder's **Wallet** tab (if Personal) or credential store shows the new card.

---

### Flow B: Foreign ID Application (Personal only)

**Preconditions:**
- Simulator A: Personal account, country set to an EU member state (e.g. Romania).

**Steps:**
1. Open **Actions** tab on the Personal wallet.
2. Tap **Foreign ID Card**.
3. **Step 1 — Document scan:** the app opens the camera. Point at any document (or tap **Skip** on simulator — the credential is pre-loaded from Veramo).
4. **Step 2 — Proof generation:** the wallet generates a `countryMembership` ZKP on-device, proving Romania (code 642) is a leaf in the EU Merkle tree. Expect ~5–10 s.
5. **Step 3 — Submit:** the presentation (proof + age ZKP) is shown for review.
6. Tap **Submit to Foreign Authority**.
7. **Expected:** success screen with submission ID.

> **Verify the ZKP:** the `countryMembership` circuit uses Merkle root `8428341660130688306333484504011921408645278038482389394981986252670980317908`. The on-chain `ZkpVerifierRegistry.get("countryMembership").vKeyHash` must match the keccak256 of the bundled `verification_key.json`.

---

### Flow C: Job Application (Enterprise ↔ Personal)

**Preconditions:**
- Simulator A: Personal account with `GraduationYearDiploma` credential (or any credential whose `graduationYear` is within the employer's acceptable range).
- Simulator B: Enterprise account (Flow 3 completed, `Enterprise` accreditation active).

**Steps — Verifier side (Simulator B, Enterprise):**
1. Open **Actions** tab.
2. Tap **Post Job Opening** → QR code appears.
   - Encodes: `purpose: job-application`, requirements `[ageVerification ≥ 18, graduationYearRange 2015–2026, diploma credential-ref]`.

**Steps — Holder side (Simulator A, Personal):**
1. Open **Actions** tab, scan the QR (or paste URI).
2. **Expected:** `PresentationConsentScreen` shows:
   - Verifier: `Acme SRL`
   - Purpose: `Job application`
   - Requirements: *"Age ≥ 18 confirmed privately"*, *"Graduation year in range 2015–2026 confirmed privately"*, *"Your diploma credential will be verified"*.
3. Tap **Approve** → re-auth → wallet generates both ZKPs on-device and signs response.

**Steps — Verifier side (Simulator B):**
1. `IncomingPresentationScreen` shows all requirements passed.
2. Tap **Approve**.
3. **Expected:** `EmploymentProof` VC issued to holder and recorded in `CredentialRegistry`.

---

## 8. On-Chain Verification Spot-Checks

Use `cast` (via the foundry container) to verify the chain state after running the flows above.

```bash
# Replace <address> with AccreditationRegistry address from TEST_ACCOUNTS.md

# Check Business Registry accreditation
docker exec did-foundry cast call <AccreditationRegistry> \
  "getAccreditationsForSubject(address)(uint256[])" \
  0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 \
  --rpc-url http://localhost:8545

# Verify trust chain for any accreditation ID
docker exec did-foundry cast call <AccreditationRegistry> \
  "validateTrustChain(uint256)(bool)" \
  1 \
  --rpc-url http://localhost:8545

# Check vKey hash in ZkpVerifierRegistry
docker exec did-foundry cast call <ZkpVerifierRegistry> \
  "get(string)((bytes32,uint16,uint64,bool))" \
  "countryMembership" \
  --rpc-url http://localhost:8545
```

---

## 9. Regression Checks

After all flows, confirm nothing broke in the previously-working paths:

| Check | Expected |
|-------|----------|
| EU Root login still restricted to `/member-states` | ✅ |
| Ministry / Institution hierarchy still navigable | ✅ |
| Personal account still shows Wallet tab | ✅ |
| University / Enterprise accounts do NOT show Wallet tab | ✅ |
| Wrong-PIN lockout still triggers at 5 failures | ✅ |
| Revoking an accreditation invalidates `validateTrustChain` | ✅ |
| Presentation with a revoked issuer accreditation is rejected | ✅ |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `500` on `/api/credentials/config` at app load | `did-credential` container not running | `docker compose -f docker-compose.services.yml up -d --build credential` |
| `500` on `/api/config` at app load | `did-accreditation` container not running | `docker compose -f docker-compose.services.yml up -d --build accreditation` |
| ZKP proving hangs forever | Running in Expo Go (no WASM support) | Use `npx expo run:ios` |
| `PIN_ALGO_MISMATCH` error | Switched between Expo Go and native build | Clear app data and re-register |
| Enterprise registration stays `Pending` | Admin client not logged in as BusinessRegistry | Log in with Anvil #4 and approve |
| `validateTrustChain` returns `false` | Accreditation was revoked or contract redeployed | Re-issue or redeploy |
| `vKeyHash mismatch` error in zkpService | Circuit re-compiled after deploy | Redeploy `Deploy.s.sol` with updated hashes |
| Mobile wallet can't find university accreditation | Anvil #3 not accredited | Complete admin section 3.2 first |
| `countryMembership` proof rejected | Wrong Merkle root in zkpService | Check `EU_MERKLE_ROOT` constant matches `keys/eu-country-merkle.json` |
| RabbitMQ error in DID.Accreditation logs | RabbitMQ container not running | `docker compose -f docker-compose.infra.yml up -d rabbitmq` |
