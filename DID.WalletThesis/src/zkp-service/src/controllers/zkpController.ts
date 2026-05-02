import { Router, Request, Response } from 'express';
import { ProofGenerator } from '../services/proofGenerator';
import { ProofVerifier } from '../services/proofVerifier';
import { VerifyRequest } from '../types/zkp.types';

const router = Router();
const generator = new ProofGenerator();
const verifier = new ProofVerifier();

// Generate age proof
// Body: { birthYear: number, currentYear: number, threshold: number }
// Returns: { proof, publicSignals }
router.post('/generate/age', async (req: Request, res: Response) => {
    const { birthYear, currentYear, threshold } = req.body;

    if (!birthYear || !currentYear || !threshold) {
        res.status(400).json({ error: 'birthYear, currentYear and threshold are required' });
        return;
    }

    const result = await generator.generateAgeProof({ birthYear, currentYear, threshold });
    res.json(result);
});

// Generate graduation year range proof
// Body: { graduationYear: number, minYear: number, maxYear: number }
// Returns: { proof, publicSignals }
router.post('/generate/graduation-year', async (req: Request, res: Response) => {
    const { graduationYear, minYear, maxYear } = req.body;

    if (!graduationYear || !minYear || !maxYear) {
        res.status(400).json({ error: 'graduationYear, minYear and maxYear are required' });
        return;
    }

    const result = await generator.generateGraduationYearProof({ graduationYear, minYear, maxYear });
    res.json(result);
});

// Verify any proof
// Body: { circuitName: string, proof: object, publicSignals: string[] }
// Returns: { valid: boolean }
router.post('/verify', async (req: Request, res: Response) => {
    const { circuitName, proof, publicSignals } = req.body as VerifyRequest;

    if (!circuitName || !proof || !publicSignals) {
        res.status(400).json({ error: 'circuitName, proof and publicSignals are required' });
        return;
    }

    const valid = await verifier.verify(circuitName, proof, publicSignals);
    res.json({ valid });
});

export default router;
