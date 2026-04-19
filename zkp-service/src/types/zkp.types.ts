export interface AgeProofInput {
    birthYear: number;
    currentYear: number;
    threshold: number;
}

export interface GraduationYearProofInput {
    graduationYear: number;
    minYear: number;
    maxYear: number;
}

export interface ProofOutput {
    proof: object;
    publicSignals: string[];
}

export interface VerifyRequest {
    circuitName: 'ageVerification' | 'graduationYearRange';
    proof: object;
    publicSignals: string[];
}

export type CircuitName = 'ageVerification' | 'graduationYearRange';
