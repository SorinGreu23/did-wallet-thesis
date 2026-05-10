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
docker compose -f docker-compose.infra.yml up -d
```

This starts:

- PostgreSQL
- RabbitMQ
- Foundry Anvil local chain

Anvil state is persisted in the `foundry_data` Docker volume. Normal stop / up cycles keep deployed contracts and on-chain accreditation data.

---

## Part 2 — Deploy Smart Contracts

Deploy only when starting from a fresh Anvil state:

```bash
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

Expected contracts:

| Contract | Address |
|---|---|
| `EURootAuthority.sol` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `AccreditationRegistry.sol` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| `CredentialRegistry.sol` | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |

The deploy script bootstraps `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` as the initial RO member state.

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

Use the admin client at `http://localhost:4200` to issue and revoke accreditations through the UI. Sign in with one of the Foundry Anvil development private keys.

## Optional — Verify Contract Deployment with Cast

```bash
docker run --rm -it \
  --entrypoint cast \
  --network did-infra \
  ghcr.io/foundry-rs/foundry:latest \
  code 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 \
  --rpc-url http://foundry:8545
```

If the output is not `0x`, the contract exists on the persisted local chain.

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

For a quick demo without running Foundry Anvil/BlockchainSync, use the direct API:

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

## Foundry Anvil Test Accounts

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
| Contract call reverts | Check that Foundry Anvil is running and that the contracts exist with `cast code`. If the chain was wiped with `down -v`, redeploy using `forge script`. |
| Accreditation not appearing after contract call | Check BlockchainSync logs — it may still be processing |
| `value too long for type character varying(42)` | Use only valid 42-char Ethereum addresses |
