const fs = require("fs");
const path = require("path");

const contracts = [
  "EURootAuthority",
  "AccreditationRegistry",
  "CredentialRegistry",
];

const abisDir = path.join(__dirname, "abis");
fs.mkdirSync(abisDir, { recursive: true });

for (const name of contracts) {
  const artifactPath = path.join(
    __dirname,
    "out",
    `${name}.sol`,
    `${name}.json`
  );

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  fs.writeFileSync(
    path.join(abisDir, `${name}.json`),
    JSON.stringify(artifact.abi, null, 2)
  );

  console.log(`Exported ABI: ${name}.json`);
}