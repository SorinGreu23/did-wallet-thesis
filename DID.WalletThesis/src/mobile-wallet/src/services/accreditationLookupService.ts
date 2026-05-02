import { Contract, JsonRpcProvider } from 'ethers';
import { CONFIG } from '../constants/config';
import AccreditationRegistryAbi from '../../../blockchain/abis/AccreditationRegistry.json';
import deploymentInfo from '../../../blockchain/deployments/latest.json';

// Scope enum from the contract (must match Solidity enum order)
export enum AccreditationScope {
  EURoot = 0,
  MemberState = 1,
  Ministry = 2,
  Institution = 3,
  BusinessRegistry = 4,
  Enterprise = 5,
}

export interface AccreditationRecord {
  id: string;
  issuer: string;
  subject: string;
  parentAccreditationId: string;
  scope: AccreditationScope;
  permissionsHash: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  exists: boolean;
}

class AccreditationLookupService {
  private getContract(): Contract {
    const provider = new JsonRpcProvider(CONFIG.ANVIL_RPC_URL);
    return new Contract(
      deploymentInfo.contracts.AccreditationRegistry.address,
      AccreditationRegistryAbi,
      provider,
    );
  }

  /** Returns all accreditation IDs for a given subject address. */
  async getAccreditationsForSubject(address: string): Promise<string[]> {
    const contract = this.getContract();
    return contract.getAccreditationsBySubject(address);
  }

  /** Returns a single accreditation record. */
  async getAccreditation(id: string): Promise<AccreditationRecord> {
    const contract = this.getContract();
    const raw = await contract.getAccreditation(id);
    return {
      id: raw.id,
      issuer: raw.issuer,
      subject: raw.subject,
      parentAccreditationId: raw.parentAccreditationId,
      scope: raw.scope as AccreditationScope,
      permissionsHash: raw.permissionsHash,
      issuedAt: raw.issuedAt.toNumber(),
      expiresAt: raw.expiresAt.toNumber(),
      revoked: raw.revoked,
      exists: raw.exists,
    };
  }

  /** Validates the full trust chain for an accreditation ID. */
  async validateTrustChain(id: string): Promise<boolean> {
    const contract = this.getContract();
    return contract.validateTrustChain(id);
  }

  /**
   * Finds the first valid Institution-scope accreditation for a wallet address.
   * Used by the University gating step.
   */
  async findActiveInstitutionAccreditation(address: string): Promise<string | null> {
    try {
      const ids: string[] = await this.getAccreditationsForSubject(address);
      for (const id of ids) {
        const record = await this.getAccreditation(id);
        if (
          record.exists &&
          !record.revoked &&
          record.scope === AccreditationScope.Institution &&
          (record.expiresAt === 0 || record.expiresAt > Date.now() / 1000)
        ) {
          const valid = await this.validateTrustChain(id);
          if (valid) return id;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Finds the first valid Enterprise-scope accreditation for a wallet address.
   * Used by the Enterprise gating step.
   */
  async findActiveEnterpriseAccreditation(address: string): Promise<string | null> {
    try {
      const ids: string[] = await this.getAccreditationsForSubject(address);
      for (const id of ids) {
        const record = await this.getAccreditation(id);
        if (
          record.exists &&
          !record.revoked &&
          record.scope === AccreditationScope.Enterprise &&
          (record.expiresAt === 0 || record.expiresAt > Date.now() / 1000)
        ) {
          const valid = await this.validateTrustChain(id);
          if (valid) return id;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

export default new AccreditationLookupService();
