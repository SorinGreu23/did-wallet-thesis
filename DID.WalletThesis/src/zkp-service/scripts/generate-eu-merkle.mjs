#!/usr/bin/env node
// Generates a depth-5 Poseidon Merkle tree over the 27 EU ISO-3166-1 numeric codes.
// Leaves are the country codes directly (not hashed). Internal nodes = Poseidon(left, right).
// Pads to 32 leaves with 0 values.
// Outputs the Merkle root and a test vector for Germany (DE=276).

import { buildPoseidon } from 'circomlibjs';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = `${ROOT}/keys`;
mkdirSync(KEYS_DIR, { recursive: true });

// EU ISO 3166-1 numeric codes (27 member states)
const EU_COUNTRIES = [
    { code: 'AT', numeric: 40 },
    { code: 'BE', numeric: 56 },
    { code: 'BG', numeric: 100 },
    { code: 'CY', numeric: 196 },
    { code: 'CZ', numeric: 203 },
    { code: 'DE', numeric: 276 },
    { code: 'DK', numeric: 208 },
    { code: 'EE', numeric: 233 },
    { code: 'GR', numeric: 300 },
    { code: 'ES', numeric: 724 },
    { code: 'FI', numeric: 246 },
    { code: 'FR', numeric: 250 },
    { code: 'HR', numeric: 191 },
    { code: 'HU', numeric: 348 },
    { code: 'IE', numeric: 372 },
    { code: 'IT', numeric: 380 },
    { code: 'LT', numeric: 440 },
    { code: 'LU', numeric: 442 },
    { code: 'LV', numeric: 428 },
    { code: 'MT', numeric: 470 },
    { code: 'NL', numeric: 528 },
    { code: 'PL', numeric: 616 },
    { code: 'PT', numeric: 620 },
    { code: 'RO', numeric: 642 },
    { code: 'SE', numeric: 752 },
    { code: 'SI', numeric: 705 },
    { code: 'SK', numeric: 703 },
];

const DEPTH = 5;         // 2^5 = 32 leaves
const TREE_SIZE = 32;    // leaves padded to 32

const poseidon = await buildPoseidon();

// Helper: hash two BigInts with Poseidon
function poseidonHash(a, b) {
    const result = poseidon([a, b]);
    return poseidon.F.toObject(result);
}

// Build leaf array: country codes, padded with 0
const leaves = new Array(TREE_SIZE).fill(0n);
EU_COUNTRIES.forEach((c, i) => {
    leaves[i] = BigInt(c.numeric);
});

// Build the full tree bottom-up
// tree[0..31] = leaves, tree[32..63] = level 1, etc.
// Actually, store as levels: level[0] = leaves (32 nodes), level[1] = 16 nodes, ..., level[5] = 1 root
const levels = [leaves.slice()]; // level 0 = leaves

for (let lvl = 0; lvl < DEPTH; lvl++) {
    const prev = levels[lvl];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
        next.push(poseidonHash(prev[i], prev[i + 1]));
    }
    levels.push(next);
}

const merkleRoot = levels[DEPTH][0];
const merkleRootHex = '0x' + merkleRoot.toString(16);

console.log('\n=== EU Country Merkle Tree ===');
console.log(`Depth:       ${DEPTH}`);
console.log(`Leaves:      ${TREE_SIZE} (${EU_COUNTRIES.length} EU + ${TREE_SIZE - EU_COUNTRIES.length} padding)`);
console.log(`Merkle Root: ${merkleRoot.toString()}`);
console.log(`Root (hex):  ${merkleRootHex}`);

// Compute path for Germany (DE=276), leaf index 5
const DE_INDEX = EU_COUNTRIES.findIndex(c => c.code === 'DE'); // should be 5

function getMerklePath(leafIndex) {
    const pathElements = [];
    const pathIndices = [];

    let currentIndex = leafIndex;
    for (let lvl = 0; lvl < DEPTH; lvl++) {
        const isRight = currentIndex % 2;  // 1 if current node is right child
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        pathElements.push(levels[lvl][siblingIndex]);
        pathIndices.push(isRight);         // 0 = current is left, 1 = current is right
        currentIndex = Math.floor(currentIndex / 2);
    }
    return { pathElements, pathIndices };
}

const { pathElements, pathIndices } = getMerklePath(DE_INDEX);

console.log(`\n=== Test Vector: Germany (DE=276), leaf index ${DE_INDEX} ===`);
console.log('Path elements (sibling hashes):');
pathElements.forEach((el, i) => console.log(`  [${i}]: ${el.toString()}`));
console.log('Path indices (0=current is left, 1=current is right):');
console.log(' ', pathIndices.join(', '));

// Verify: reconstruct root from DE path
let node = BigInt(276);
for (let i = 0; i < DEPTH; i++) {
    const left  = pathIndices[i] === 1 ? pathElements[i] : node;
    const right = pathIndices[i] === 1 ? node : pathElements[i];
    node = poseidonHash(left, right);
}
console.log(`\nVerification (should match root): ${node.toString()}`);
console.log(`Root matches: ${node === merkleRoot}`);

// Build JSON output
const output = {
    merkleRoot: merkleRoot.toString(),
    merkleRootHex,
    depth: DEPTH,
    countries: EU_COUNTRIES.map((c, i) => ({ code: c.code, numeric: c.numeric, leafIndex: i })),
    testVector: {
        countryCode: 276,
        pathElements: pathElements.map(e => e.toString()),
        pathIndices,
    },
};

const outPath = `${KEYS_DIR}/eu-country-merkle.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote: ${outPath}`);
