import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Deploying EU DID Wallet Smart Contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============ 1. Deploy EURootAuthority ============
  console.log("📜 Deploying EURootAuthority...");

  const genesisBlockHash = ethers.keccak256(ethers.toUtf8Bytes("EU_DID_WALLET_GENESIS"));
  const officialDID = "did:web:europa.eu";

  const EURootAuthority = await ethers.getContractFactory("EURootAuthority");
  const rootAuthority = await EURootAuthority.deploy(genesisBlockHash, officialDID);
  await rootAuthority.waitForDeployment();

  const rootAuthorityAddress = await rootAuthority.getAddress();
  console.log("✅ EURootAuthority deployed to:", rootAuthorityAddress);
  console.log("   Genesis Hash:", genesisBlockHash);
  console.log("   Official DID:", officialDID);
  console.log("   Deployment Block:", await rootAuthority.DEPLOYMENT_BLOCK(), "\n");

  // ============ 2. Bootstrap Initial Member States ============
  console.log("🏛️  Bootstrapping initial member states...");

  const initialMemberStates = [
    { address: deployer.address, code: "RO", did: "did:web:gov.ro" },
    // Add more member states as needed for testing
  ];

  const addresses = initialMemberStates.map(ms => ms.address);
  const codes = initialMemberStates.map(ms => ms.code);
  const dids = initialMemberStates.map(ms => ms.did);

  const bootstrapTx = await rootAuthority.bootstrapMemberStates(addresses, codes, dids);
  await bootstrapTx.wait();

  console.log("✅ Bootstrapped", initialMemberStates.length, "member state(s)");
  for (const ms of initialMemberStates) {
    console.log(`   ${ms.code}: ${ms.address}`);
  }
  console.log();

  // ============ 3. Add Deployment Witnesses ============
  console.log("👁️  Adding deployment witnesses...");

  // In production, this would be 18+ different member state signatures
  // For testing, we'll use the deployer account
  const witnessTx = await rootAuthority.addDeploymentWitness(deployer.address);
  await witnessTx.wait();

  console.log("✅ Added deployment witness:", deployer.address);
  console.log("   Witness count:", await rootAuthority.witnessCount());
  console.log("   Ceremony completed:", await rootAuthority.deploymentCeremonyCompleted());
  console.log();

  // ============ 4. Deploy AccreditationRegistry ============
  console.log("📜 Deploying AccreditationRegistry...");

  const AccreditationRegistry = await ethers.getContractFactory("AccreditationRegistry");
  const accreditationRegistry = await AccreditationRegistry.deploy(rootAuthorityAddress);
  await accreditationRegistry.waitForDeployment();

  const accreditationRegistryAddress = await accreditationRegistry.getAddress();
  console.log("✅ AccreditationRegistry deployed to:", accreditationRegistryAddress);
  console.log("   Connected to EURootAuthority:", rootAuthorityAddress, "\n");

  // ============ 5. Deploy CredentialRegistry ============
  console.log("📜 Deploying CredentialRegistry...");

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(accreditationRegistryAddress);
  await credentialRegistry.waitForDeployment();

  const credentialRegistryAddress = await credentialRegistry.getAddress();
  console.log("✅ CredentialRegistry deployed to:", credentialRegistryAddress);
  console.log("   Connected to AccreditationRegistry:", accreditationRegistryAddress, "\n");

  // ============ 6. Save Deployment Artifacts ============
  console.log("💾 Saving deployment artifacts...");

  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      EURootAuthority: {
        address: rootAuthorityAddress,
        genesisBlockHash: genesisBlockHash,
        officialDID: officialDID,
        deploymentBlock: (await rootAuthority.DEPLOYMENT_BLOCK()).toString()
      },
      AccreditationRegistry: {
        address: accreditationRegistryAddress
      },
      CredentialRegistry: {
        address: credentialRegistryAddress
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `deployment-${Date.now()}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  const latestPath = path.join(deploymentsDir, "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("✅ Deployment info saved to:", deploymentPath);
  console.log("✅ Latest deployment:", latestPath, "\n");

  // ============ 7. Export ABIs ============
  console.log("📋 Exporting ABIs...");

  const abisDir = path.join(__dirname, "..", "abis");
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }

  const contracts = [
    { name: "EURootAuthority", artifact: await ethers.getContractFactory("EURootAuthority") },
    { name: "AccreditationRegistry", artifact: await ethers.getContractFactory("AccreditationRegistry") },
    { name: "CredentialRegistry", artifact: await ethers.getContractFactory("CredentialRegistry") }
  ];

  for (const contract of contracts) {
    const abi = contract.artifact.interface.formatJson();
    const abiPath = path.join(abisDir, `${contract.name}.json`);
    fs.writeFileSync(abiPath, abi);
    console.log(`✅ Exported ${contract.name} ABI`);
  }

  console.log("\n🎉 Deployment complete!\n");
  console.log("📌 Contract Addresses:");
  console.log("   EURootAuthority:", rootAuthorityAddress);
  console.log("   AccreditationRegistry:", accreditationRegistryAddress);
  console.log("   CredentialRegistry:", credentialRegistryAddress);
  console.log("\n💡 Next steps:");
  console.log("   1. Update microservice configuration with contract addresses");
  console.log("   2. Copy ABIs to microservice projects");
  console.log("   3. Start blockchain sync service");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
