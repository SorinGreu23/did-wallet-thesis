# Demo Guide — DID Wallet Thesis

End-to-end walkthrough for testing the blockchain-driven accreditation flow.

---

## Prerequisites

- Docker Desktop running
- .NET 10 SDK installed
- Node.js 20+ installed

---

## Part 1 — Start Infrastructure

```bash
# from repo root
docker-compose up postgres rabbitmq hardhat -d
```

**Create databases** (one-time, or after a full Docker reset):

```bash
docker exec -it did-postgres psql -U did_user -d did_wallet -c "
  CREATE DATABASE did_identity;
  CREATE DATABASE did_accreditation;
  CREATE DATABASE did_blockchainsync;
"
```

---

## Part 2 — Deploy Smart Contracts

Run this every time the Hardhat container restarts (its state is ephemeral):

```bash
cd blockchain
npm install        # first time only
npx hardhat run scripts/deploy.ts --network localhost
```

Expected output:
```
✅ EURootAuthority deployed to:      0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ AccreditationRegistry deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
✅ CredentialRegistry deployed to:    0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

> Contract addresses are deterministic — they always match the values already in `BlockchainSync/appsettings.json`.

The deploy script also bootstraps `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Hardhat account #0) as member state **"RO"**, which authorises it to issue accreditations.

---

## Part 3 — Start Services

Open a separate terminal for each:

```bash
# Terminal 1 — BlockchainSync (listens to contract events, publishes to RabbitMQ)
cd DID.WalletThesis
dotnet run --project src/Services/DID.BlockchainSync

# Terminal 2 — Accreditation service (consumes RabbitMQ events, exposes REST API)
dotnet run --project src/Services/DID.Accreditation

# Terminal 3 — Identity service (optional, needed for DID creation)
dotnet run --project src/Services/DID.Identity
```

> Migrations run automatically on startup — no `dotnet ef database update` needed.

Service URLs:
| Service | URL | Swagger |
|---|---|---|
| Identity | http://localhost:5259 | http://localhost:5259/swagger |
| Accreditation | http://localhost:5211 | http://localhost:5211/swagger |

---

## Part 4 — Trigger Blockchain Events

Open the Hardhat console:

```bash
cd blockchain
npx hardhat console --network localhost
```

### Issue a Ministry accreditation

```js
const registry = await ethers.getContractAt(
  "AccreditationRegistry",
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
)

const tx = await registry.issueAccreditation(
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // subject: Hardhat account #1
  2,               // scope: 2 = Ministry
  ethers.ZeroHash, // no parent accreditation
  ethers.ZeroHash, // permissions hash
  0                // no expiry
)

const receipt = await tx.wait()
console.log("Block:", receipt.blockNumber, "Tx:", receipt.hash)
```

### Issue an Institution accreditation (requires Ministry parent)

```js
// First get the accreditation ID from the Ministry tx above
const filter = registry.filters.AccreditationIssued()
const events = await registry.queryFilter(filter)
const ministryId = events[0].args.id

const tx2 = await registry.connect(
  (await ethers.getSigners())[1]  // account #1 is now a Ministry, issues to account #2
).issueAccreditation(
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // subject: Hardhat account #2
  3,          // scope: 3 = Institution
  ministryId, // parent = the Ministry accreditation
  ethers.ZeroHash,
  0
)
await tx2.wait()
```

### Revoke an accreditation

```js
await (await registry.revokeAccreditation(ministryId)).wait()
```

---

## Part 5 — Verify in Postman

### List all accreditations (should show blockchain data)
```
GET http://localhost:5211/api/accreditations
```

### Verify a specific accreditation
```
GET http://localhost:5211/api/accreditations/{accreditationId}/verify
```

### Check accreditations for a subject
```
GET http://localhost:5211/api/accreditations?subjectDid=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

---

## Part 6 — Demo-Only Shortcut (no blockchain needed)

For a quick demo without running Hardhat/BlockchainSync, use the direct API:

### Create DIDs
```
POST http://localhost:5259/api/dids
{
  "controllerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}

POST http://localhost:5259/api/dids
{
  "controllerAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```

### Issue accreditation directly
```
POST http://localhost:5211/api/accreditations
{
  "issuerDID": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "subjectDID": "did:ethr:sepolia:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "scope": "Institution",
  "parentAccreditationId": null
}
```

### Verify it
```
GET http://localhost:5211/api/accreditations/{accreditationId}/verify
```

### Revoke it
```
DELETE http://localhost:5211/api/accreditations/{accreditationId}
{
  "revokedByDID": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

### Verify again (should now show Revoked)
```
GET http://localhost:5211/api/accreditations/{accreditationId}/verify
```

---

## Scope Values Reference

| Value | Name | Issued by |
|---|---|---|
| 1 | MemberState | EU Root Authority |
| 2 | Ministry | Member State |
| 3 | Institution | Ministry |
| 4 | Department | Institution |

---

## Hardhat Test Accounts

| # | Address | Private Key |
|---|---|---|
| 0 (deployer / RO member state) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `did_blockchainsync does not exist` | Run the CREATE DATABASE commands in Part 1 |
| Contract call reverts | Re-deploy contracts (`npx hardhat run scripts/deploy.ts --network localhost`) |
| Accreditation not appearing after contract call | Check BlockchainSync logs — it may still be processing |
| `value too long for type character varying(42)` | Use only valid 42-char Ethereum addresses |
