#!/usr/bin/env node
// Generates a depth-5 Poseidon Merkle tree over the 27 EU ISO-3166-1 numeric codes.
// Leaves are the country codes directly (not hashed). Internal nodes = Poseidon(left, right).
// Pads to 32 leaves with 0 values.
// Outputs the Merkle root and precomputed paths for ALL 27 EU countries.

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

console.log(`\nEU Merkle Tree: depth=${DEPTH}, root=${merkleRoot.toString()}`);

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

// Compute and verify paths for all 27 countries
const paths = {};
for (const c of EU_COUNTRIES) {
    const leafIndex = EU_COUNTRIES.indexOf(c);
    const { pathElements, pathIndices } = getMerklePath(leafIndex);

    // Verify path reconstructs the root
    let node = BigInt(c.numeric);
    for (let i = 0; i < DEPTH; i++) {
        const left  = pathIndices[i] === 1 ? pathElements[i] : node;
        const right = pathIndices[i] === 1 ? node : pathElements[i];
        node = poseidonHash(left, right);
    }
    if (node !== merkleRoot) throw new Error(`Path verification failed for ${c.code}`);

    paths[c.code] = {
        numeric: c.numeric,
        leafIndex,
        pathElements: pathElements.map(e => e.toString()),
        pathIndices,
    };
}

console.log(`\nVerified paths for all ${EU_COUNTRIES.length} EU countries. Root: ${merkleRoot.toString()}`);

// Build JSON output
const output = {
    merkleRoot: merkleRoot.toString(),
    merkleRootHex,
    depth: DEPTH,
    paths,
};

const outPath = `${KEYS_DIR}/eu-country-merkle.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote: ${outPath}`);
