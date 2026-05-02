# EU DID Wallet - Smart Contracts

Blockchain infrastructure for the EU Decentralized Digital Identity System with hierarchical trust chains.

## Overview

Three core smart contracts implement the blockchain-as-source-of-truth architecture:

1. **EURootAuthority.sol** - Root of trust with three-layer trust anchor
2. **AccreditationRegistry.sol** - Hierarchical accreditation with on-chain trust chain validation
3. **CredentialRegistry.sol** - Credential status tracking with issuer accreditation validation

## Trust Hierarchy

```
EU Root Authority (multi-sig governance, 66% approval)
  ↓
Member State (validated by root authority)
  ↓
Ministry (validated parent chain)
  ↓
Institution (validated parent chain)
  ↓
Credential (validates issuer accreditation)
```

## Installation

```bash
cd blockchain
npm install
```

## Compile Contracts

```bash
npm run compile
```

This generates TypeChain types and exports ABIs to the `abis/` directory.

## Run Tests

```bash
npm test
```

All tests should pass with >90% coverage. Tests validate:
- Deployment ceremony with witness signatures
- Multi-sig governance (66% approval threshold)
- Hierarchical accreditation issuance
- Trust chain validation
- Credential recording with issuer validation
- Revocation flows

## Deploy

### Local Development (Foundry Anvil)

Deploy using the Foundry container from the repo root:

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

Anvil state is persisted in the `foundry_data` Docker volume. Redeployment is only needed after `docker compose ... down -v`.

### Sepolia Testnet

1. Set environment variables:
```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
export PRIVATE_KEY="your_private_key"
```

2. Deploy:
```bash
npm run deploy:sepolia
```

## Contract Addresses

After deployment, contract addresses are saved to:
- `deployments/latest.json` - Most recent deployment
- `deployments/deployment-{timestamp}.json` - Timestamped deployment record

## ABIs

Contract ABIs are exported to `abis/` directory for use by microservices:
- `EURootAuthority.json`
- `AccreditationRegistry.json`
- `CredentialRegistry.json`

Copy these to microservice projects for blockchain integration.

## Key Functions

### EURootAuthority

- `isMemberState(address)` - Check if address is an EU member state
- `verifyDeploymentCeremony()` - Validate deployment ceremony integrity
- `bootstrapMemberStates()` - Initialize member states (one-time)
- `proposeAddMemberState()` - Create governance proposal
- `voteOnProposal()` - Vote on governance proposals

### AccreditationRegistry

- `issueAccreditation()` - Issue new accreditation (validates parent chain)
- `validateTrustChain(bytes32)` - Validate complete trust chain
- `hasValidAccreditation(address, scope)` - Check authorization
- `getTrustChain(bytes32)` - Retrieve full chain from root to target
- `revokeAccreditation(bytes32)` - Revoke accreditation

### CredentialRegistry

- `recordCredential()` - Record credential (validates issuer accreditation)
- `isActive(bytes32)` - Check if credential is active
- `verifyCredential(bytes32)` - Complete verification (status + trust chain)
- `revokeCredential(bytes32, reason)` - Revoke credential
- `suspendCredential(bytes32, reason)` - Suspend credential
- `batchVerifyCredentials(bytes32[])` - Batch verification

## Events

Microservices subscribe to these events via Blockchain Sync Service:

**Accreditation Events:**
- `AccreditationIssued(id, issuer, subject, scope, parentId)`
- `AccreditationRevoked(id, revokedBy, timestamp)`

**Credential Events:**
- `CredentialIssued(id, issuer, holder, type, accreditationId)`
- `CredentialRevoked(id, revokedBy, timestamp, reason)`
- `CredentialSuspended(id, suspendedBy, timestamp, reason)`
- `CredentialReactivated(id, reactivatedBy, timestamp)`

## Integration with Microservices

1. **Copy ABIs**: Copy `abis/*.json` to microservice `Infrastructure/Blockchain/ABIs/`

2. **Update Configuration**: Add contract addresses to `appsettings.json`:
```json
{
  "Blockchain": {
    "RpcUrl": "http://localhost:8545",
    "Contracts": {
      "EURootAuthority": {
        "Address": "0x...",
        "AbiPath": "ABIs/EURootAuthority.json"
      }
    }
  }
}
```

3. **Use IBlockchainService**: All blockchain calls go through the shared `IBlockchainService` interface

## Development Ceremony Simulation

For testing, the deployment script simulates a simplified ceremony:

1. Deploy EURootAuthority
2. Bootstrap initial member states
3. Deploy AccreditationRegistry
4. Deploy CredentialRegistry
5. Export ABIs and deployment info

In production, the full deployment ceremony would involve:
- 18+ EU member state witness signatures
- GPG-signed DID configuration at europa.eu
- Bidirectional verification (website ↔ contract)

## Security Considerations

- **Immutable Trust Anchors**: Genesis hash, deployment block, and official DID are immutable
- **Multi-Sig Governance**: 66% approval required for member state changes
- **Hierarchical Validation**: Each level validates parent chain before authorization
- **On-Chain Verification**: All authorization decisions read from blockchain
- **Event Transparency**: All state changes emit events for auditability

## Next Steps

After deploying contracts:

1. Start Blockchain Sync Service to mirror events to PostgreSQL
2. Configure microservices with contract addresses
3. Test complete flow: accreditation → credential → verification
4. Verify mobile app can read blockchain directly without backend

## License

MIT
