# Testing Guide — EU DID Accreditation Platform

## Prerequisites

- Docker Desktop running
- Node.js 18+
- .NET 10 SDK
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (via Xcode) for mobile wallet

---

## 1. Start Infrastructure

```bash
# From repo root
docker compose -f docker-compose.infra.yml up -d

# Deploy only if starting from a fresh Anvil state
docker run --rm -it \
  --entrypoint forge \
  --network did-infra \
  -v "$PWD:/workspace" \
  -w /workspace/blockchain \
  ghcr.io/foundry-rs/foundry:latest \
  script script/Deploy.s.sol \
    --rpc-url http://foundry:8545 \
    --broadcast \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This deploys the three smart contracts and bootstraps Romania ("RO") as the initial member state. Foundry Anvil persists the local chain state in Docker volume `foundry_data`, so redeployment is not required after normal container restarts.

## 2. Start the Accreditation Service

```bash
cd DID.WalletThesis
dotnet run --project src/Services/DID.Accreditation
```

Runs on `http://localhost:5211`. Auto-migrates the database on startup.

## 3. Start the Admin Client

```bash
cd DID.WalletThesis/src/admin-client
npm start
```

Runs on `http://localhost:4200`. The proxy routes `/api/*` to the backend automatically.

---

## 5. Test Admin Client Auth + RBAC

### Foundry Anvil Test Accounts

Foundry Anvil provides deterministic local development accounts:

| Role | Account # | Address | Private Key |
|------|-----------|---------|-------------|
| **EU Root** (deployer) | `#0` | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Romania** (member state) | `#1` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Ministry** (create it) | `#2` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| **University** (create it) | `#3` | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

### Flow A — Login as EU Root

1. Go to `http://localhost:4200` — redirects to `/login`
2. Paste Account #0's private key (without `0x` prefix)
3. You should see the derived DID: `did:ethr:sepolia:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
4. Click **"Sign In with DID-Auth"** — redirected to `/member-states`
5. Full sidebar visible: **Member States**, **Ministries**, **Universities**

### Flow B — Issue accreditations down the hierarchy

As EU Root:
1. On `/member-states`, click **"Issue Accreditation"**
2. Enter name: `Romania`, address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
3. Submit — wait for blockchain confirmation
4. Click on Romania to navigate to `/ministries`

### Flow C — Login as Member State (RBAC test)

1. **Logout** (bottom-left of sidebar)
2. Login with Account #1's private key
3. Sidebar now shows **only Ministries and Universities** (no Member States — insufficient scope)
4. Issue a Ministry accreditation for Account #2's address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

### Flow D — Login as Ministry (RBAC test)

1. Logout, login with Account #2's private key
2. Sidebar now shows **only Universities**
3. Issue a University accreditation for Account #3's address: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`

### Flow E — Access denied test

1. Logout, login with any private key that has no on-chain accreditation
2. You should get a **403 error**: "DID has no on-chain accreditation"

### Flow F — Verify trust chain

1. Login as EU Root
2. Navigate to any accreditation and click **"Inspect"**
3. Click **"Verify"** — this calls `validateTrustChain()` on-chain and shows the result

---

## 6. Test the Mobile Wallet

```bash
cd DID.WalletThesis/src/mobile-wallet
npm install
npx expo start --ios
```

### First launch (new user)

1. App shows the **WelcomeScreen** with a "Create Wallet" button
2. Tap it — wallet is created (secret key generated and stored in iOS Keychain via expo-secure-store, DID created via Veramo)
3. You're taken to **HomeScreen** with Credentials and Identity tabs

### Subsequent launches (returning user)

1. App detects an existing wallet via secure storage
2. Bypasses login — goes straight to **HomeScreen**

### Identity tab (biometric gate)

1. Tap the **Identity** tab
2. If your device has Face ID / Touch ID — biometric prompt appears
3. After authentication, your DID details and keys are shown

---

## 7. Quick Smoke Test (API only)

If you just want to verify DID-Auth works without the UI:

```bash
# 1. Request a challenge
curl -s -X POST http://localhost:5211/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"did":"did:ethr:sepolia:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"}' | jq .

# Returns: { "nonce": "...", "expiresAt": "..." }

# 2. List accreditations (requires auth — use a JWT from step 1's verify flow)
# Without auth, only credential queries by holderDid are allowed (for mobile wallet sync)
curl -s http://localhost:5214/api/credentials?holderDid=did:ethr:sepolia:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 | jq .

# 3. Verify an accreditation on-chain
curl -s http://localhost:5211/api/accreditations/{accreditationId}/verify | jq .
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Connection refused` on port 5211 | Accreditation service not running — check `dotnet run` output |
| `eth_call` errors | Foundry Anvil container not running — `docker compose -f docker-compose.infra.yml up -d foundry` |
| Contract code is `0x` | Contracts are not deployed on the current Anvil state. Deploy with `forge script`, or check that `foundry_data` was not deleted. |
| `relation does not exist` | Postgres not initialised — destroy and recreate infra: `docker compose -f docker-compose.infra.yml down -v && docker compose -f docker-compose.infra.yml up -d` |
| Login returns 403 | The DID has no on-chain accreditation — use an account that was accredited |
| Angular shows blank page | Check browser console — likely a proxy or CORS issue |
| Mobile wallet crashes on start | Run `npm install` again, then `npx expo start --clear` |
