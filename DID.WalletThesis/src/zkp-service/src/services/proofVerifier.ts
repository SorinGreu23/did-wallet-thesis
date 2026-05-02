import * as snarkjs from 'snarkjs';
import path from 'path';
import fs from 'fs';
import { CircuitName } from '../types/zkp.types';

const KEYS_DIR = path.join(__dirname, '../../keys');

export class ProofVerifier {
    async verify(
        circuitName: CircuitName,
        proof: object,
        publicSignals: string[]
    ): Promise<boolean> {
        const vKeyPath = path.join(KEYS_DIR, `${circuitName}_verification_key.json`);
        const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));

        return snarkjs.groth16.verify(vKey, publicSignals, proof);
    }
}
