const fs = require("fs");
const path = require("path");

const chainId = "31337";

const broadcastPath = path.join(
  __dirname,
  "broadcast",
  "Deploy.s.sol",
  chainId,
  "run-latest.json"
);

if (!fs.existsSync(broadcastPath)) {
  throw new Error(
    `Missing Foundry broadcast file: ${broadcastPath}. Run contract-deployer first.`
  );
}

const broadcast = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));

const deploymentsDir = path.join(__dirname, "deployments");
fs.mkdirSync(deploymentsDir, { recursive: true });

function findDeployment(contractName) {
  const tx = broadcast.transactions.find(
    (tx) =>
      tx.transactionType === "CREATE" &&
      tx.contractName === contractName &&
      tx.contractAddress
  );

  if (!tx) {
    throw new Error(`Could not find deployment for ${contractName}`);
  }

  return tx.contractAddress;
}

const deploymentInfo = {
  network: "foundry-anvil",
  chainId,
  deployer: broadcast.transactions[0]?.from ?? null,
  deployedAt: new Date().toISOString(),
  contracts: {
    EURootAuthority: {
      address: findDeployment("EURootAuthority"),
      genesisBlockHash:
        "0xa63e28e9ae1a4f9003818df22350798cec8d931a2b0854738525191e982fd47f",
      officialDID: "did:web:europa.eu",
    },
    AccreditationRegistry: {
      address: findDeployment("AccreditationRegistry"),
    },
    CredentialRegistry: {
      address: findDeployment("CredentialRegistry"),
    },
    ZkpVerifierRegistry: {
      address: findDeployment("ZkpVerifierRegistry"),
    },
  },
};

const latestPath = path.join(deploymentsDir, "latest.json");
fs.writeFileSync(latestPath, JSON.stringify(deploymentInfo, null, 2));

console.log(`Exported deployment info to ${latestPath}`);
console.log(deploymentInfo.contracts);