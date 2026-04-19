#!/usr/bin/env node
// Cross-platform circuit setup script (Windows, macOS, Linux).
// Uses snarkjs JS API directly and shells out to circom for compilation.
//
// Prerequisites:
//   - circom CLI installed and in PATH (https://docs.circom.io/getting-started/installation/)
//   - Run from zkp-service/: node scripts/setup-circuits.mjs

import { execSync } from 'child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';

const ROOT        = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CIRCUITS    = `${ROOT}/src/circuits`;
const COMPILED    = `${ROOT}/circuits_compiled`;
const KEYS        = `${ROOT}/keys`;
const PTAU_0      = `${KEYS}/pot12_0000.ptau`;
const PTAU_1      = `${KEYS}/pot12_0001.ptau`;
const PTAU_FINAL  = `${KEYS}/powersOfTau.ptau`;

mkdirSync(COMPILED, { recursive: true });
mkdirSync(KEYS,     { recursive: true });

function run(cmd) {
    console.log(`  $ ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

// ── Powers of Tau ────────────────────────────────────────────────────────────

if (!existsSync(PTAU_FINAL)) {
    console.log('\n==> Generating powers of tau (power 12)...');
    await snarkjs.powersOfTau.newAccumulator(undefined, 12, PTAU_0, console);
    await snarkjs.powersOfTau.contribute(PTAU_0, PTAU_1, 'did-wallet-thesis', 'did wallet thesis entropy');
    await snarkjs.powersOfTau.preparePhase2(PTAU_1, PTAU_FINAL, console);
    rmSync(PTAU_0, { force: true });
    rmSync(PTAU_1, { force: true });
    console.log('==> Powers of tau ready.');
} else {
    console.log('\n==> Powers of tau already exists, skipping.');
}

// ── Compile + keygen ─────────────────────────────────────────────────────────

async function setupCircuit(name) {
    console.log(`\n==> Compiling ${name}...`);
    run(`circom ${CIRCUITS}/${name}.circom --r1cs --wasm --sym --output ${COMPILED}`);

    // snarkjs outputs wasm inside a subdirectory - move it up
    const wasmSub = `${COMPILED}/${name}_js/${name}.wasm`;
    if (existsSync(wasmSub)) {
        renameSync(wasmSub, `${COMPILED}/${name}.wasm`);
        rmSync(`${COMPILED}/${name}_js`, { recursive: true, force: true });
    }

    console.log(`==> Generating zkey for ${name}...`);
    await snarkjs.zKey.newZKey(`${COMPILED}/${name}.r1cs`, PTAU_FINAL, `${KEYS}/${name}_0000.zkey`, console);

    console.log(`==> Contributing to ceremony for ${name}...`);
    await snarkjs.zKey.contribute(`${KEYS}/${name}_0000.zkey`, `${KEYS}/${name}_final.zkey`, 'did-wallet-thesis', 'did wallet thesis entropy');
    rmSync(`${KEYS}/${name}_0000.zkey`, { force: true });

    console.log(`==> Exporting verification key for ${name}...`);
    const vKey = await snarkjs.zKey.exportVerificationKey(`${KEYS}/${name}_final.zkey`);
    const { writeFileSync } = await import('fs');
    writeFileSync(`${KEYS}/${name}_verification_key.json`, JSON.stringify(vKey, null, 2));

    console.log(`==> ${name} ready.`);
}

await setupCircuit('ageVerification');
await setupCircuit('graduationYearRange');

console.log('\nAll circuits compiled and keys generated.');
