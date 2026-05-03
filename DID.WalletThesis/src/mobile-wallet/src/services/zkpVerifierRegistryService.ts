import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { CONFIG } from '../constants/config';
import ZkpVerifierRegistryAbi from '../blockchain/abis/ZkpVerifierRegistry.json';
import deploymentInfo from '../blockchain/deployments/latest.json';

export interface CircuitRecord {
    vKeyHash: string;
    version: number;
    registeredAt: number;
    active: boolean;
}

function toNumber(value: bigint | number | { toNumber?: () => number }): number {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return value;
    if (value?.toNumber) return value.toNumber();
    return Number(value);
}

class ZkpVerifierRegistryService {
    private getContract(): Contract {
        const provider = new JsonRpcProvider(CONFIG.ANVIL_RPC_URL);

        return new Contract(
            deploymentInfo.contracts.ZkpVerifierRegistry.address,
            ZkpVerifierRegistryAbi,
            provider,
        );
    }

    async getCircuit(name: string): Promise<CircuitRecord> {
        const contract = this.getContract();
        const raw = await contract.get(name);

        return {
            vKeyHash: raw.vKeyHash,
            version: toNumber(raw.version),
            registeredAt: toNumber(raw.registeredAt),
            active: raw.active,
        };
    }

    async isCircuitActive(name: string): Promise<boolean> {
        const contract = this.getContract();
        return contract.isActive(name);
    }

    async circuitExists(name: string): Promise<boolean> {
        const contract = this.getContract();
        return contract.exists(name);
    }

    /**
     * Temporary helper for Phase B.4.
     * Later, this should hash canonical JSON verification keys.
     */
    hashVerificationKeyJsonString(json: string): string {
        return keccak256(toUtf8Bytes(json));
    }

    async assertBundledVKeyMatchesOnChain(
        circuitName: string,
        verificationKeyJsonString: string,
    ): Promise<boolean> {
        const record = await this.getCircuit(circuitName);

        if (!record.active) {
            return false;
        }

        const localHash = this.hashVerificationKeyJsonString(verificationKeyJsonString);

        return localHash.toLowerCase() === record.vKeyHash.toLowerCase();
    }
}

export default new ZkpVerifierRegistryService();
