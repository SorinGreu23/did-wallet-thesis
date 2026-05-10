pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Proves that countryCode is a leaf in the EU country Merkle tree (depth=5, 32 leaves)
// without revealing which specific country or its position.
template CountryMembership() {
    signal input countryCode;           // private: ISO 3166-1 numeric code
    signal input pathElements[5];       // private: sibling node hashes on the Merkle path
    signal input pathIndices[5];        // private: 0=current is left, 1=current is right

    signal input merkleRoot;            // public: Poseidon Merkle root of EU country set

    signal output valid;

    // Reject zero (empty leaf) — country code must be non-zero
    component nz = IsZero();
    nz.in <== countryCode;
    nz.out === 0;

    // Walk the Merkle path: start from the leaf (countryCode itself, not hashed)
    signal nodes[6];
    nodes[0] <== countryCode;

    component leftMux[5];
    component rightMux[5];
    component hashers[5];

    for (var i = 0; i < 5; i++) {
        // if pathIndices[i]==0: current is LEFT, sibling is RIGHT
        // if pathIndices[i]==1: current is RIGHT, sibling is LEFT
        leftMux[i] = Mux1();
        leftMux[i].c[0] <== nodes[i];
        leftMux[i].c[1] <== pathElements[i];
        leftMux[i].s <== pathIndices[i];

        rightMux[i] = Mux1();
        rightMux[i].c[0] <== pathElements[i];
        rightMux[i].c[1] <== nodes[i];
        rightMux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== leftMux[i].out;
        hashers[i].inputs[1] <== rightMux[i].out;

        nodes[i + 1] <== hashers[i].out;
    }

    // Computed root must equal the expected public root
    component eq = IsEqual();
    eq.in[0] <== nodes[5];
    eq.in[1] <== merkleRoot;
    valid <== eq.out;
    valid === 1;
}

component main { public [merkleRoot] } = CountryMembership();
