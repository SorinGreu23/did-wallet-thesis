import { Contract, JsonRpcProvider } from 'ethers';
import { CONFIG } from '../constants/config';
import AccreditationRegistryAbi from '../blockchain/abis/AccreditationRegistry.json';
import deploymentInfo from '../blockchain/deployments/latest.json';
import { CredentialRef } from '../types/presentation';

export interface VerificationResult {
  credentialType: string;
  credentialHash: string;
  issuerAccreditationId: string;
  trustChainValid: boolean;
  error?: string;
}

class ChainVerifier {
  private getAccreditationContract(): Contract {
    return new Contract(
      deploymentInfo.contracts.AccreditationRegistry.address,
      AccreditationRegistryAbi,
      new JsonRpcProvider(CONFIG.ANVIL_RPC_URL),
    );
  }

  async verifyCredentialRef(ref: CredentialRef): Promise<VerificationResult> {
    try {
      const contract = this.getAccreditationContract();
      const isValid: boolean = await contract.validateTrustChain(ref.issuerAccreditationId);
      return {
        credentialType: ref.credentialType,
        credentialHash: ref.credentialHash,
        issuerAccreditationId: ref.issuerAccreditationId,
        trustChainValid: isValid,
      };
    } catch (e: any) {
      return {
        credentialType: ref.credentialType,
        credentialHash: ref.credentialHash,
        issuerAccreditationId: ref.issuerAccreditationId,
        trustChainValid: false,
        error: e.message,
      };
    }
  }

  async verifyAll(refs: CredentialRef[]): Promise<VerificationResult[]> {
    return Promise.all(refs.map((r) => this.verifyCredentialRef(r)));
  }
}

export default new ChainVerifier();
