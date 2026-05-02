pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";

// Proves that (currentYear - birthYear) >= threshold
// without revealing birthYear
template AgeVerification() {
    // Private inputs (not revealed to verifier)
    signal input birthYear;

    // Public inputs (verifier knows these)
    signal input currentYear;
    signal input threshold;

    // Output
    signal output valid;

    // Compute age
    signal age;
    age <== currentYear - birthYear;

    // Assert age >= threshold (e.g. >= 21)
    component gte = GreaterEqThan(8); // 8 bits supports ages 0-255
    gte.in[0] <== age;
    gte.in[1] <== threshold;

    valid <== gte.out;
}

component main { public [currentYear, threshold] } = AgeVerification();
