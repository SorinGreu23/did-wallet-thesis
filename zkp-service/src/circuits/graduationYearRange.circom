pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";

// Proves that minYear <= graduationYear <= maxYear
// without revealing the exact graduation year
template GraduationYearRange() {
    // Private input (not revealed to verifier)
    signal input graduationYear;

    // Public inputs (verifier knows these)
    signal input minYear;
    signal input maxYear;

    // Output
    signal output valid;

    // Assert graduationYear >= minYear
    component gte = GreaterEqThan(16); // 16 bits supports years up to 65535
    gte.in[0] <== graduationYear;
    gte.in[1] <== minYear;

    // Assert graduationYear <= maxYear
    component lte = LessEqThan(16);
    lte.in[0] <== graduationYear;
    lte.in[1] <== maxYear;

    // Both conditions must hold
    valid <== gte.out * lte.out;
}

component main { public [minYear, maxYear] } = GraduationYearRange();
