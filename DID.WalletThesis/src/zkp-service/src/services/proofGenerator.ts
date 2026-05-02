import * as snarkjs from 'snarkjs';
import path from 'path';
import { AgeProofInput, GraduationYearProofInput, ProofOutput } from '../types/zkp.types';

const COMPILED_DIR = path.join(__dirname, '../../circuits_compiled');
const KEYS_DIR = path.join(__dirname, '../../keys');

export class ProofGenerator {
    async generateAgeProof(input: AgeProofInput): Promise<ProofOutput> {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            path.join(COMPILED_DIR, 'ageVerification.wasm'),
            path.join(KEYS_DIR, 'ageVerification_final.zkey')
        );

        return { proof, publicSignals };
    }

    async generateGraduationYearProof(input: GraduationYearProofInput): Promise<ProofOutput> {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            path.join(COMPILED_DIR, 'graduationYearRange.wasm'),
            path.join(KEYS_DIR, 'graduationYearRange_final.zkey')
        );

        return { proof, publicSignals };
    }
}
