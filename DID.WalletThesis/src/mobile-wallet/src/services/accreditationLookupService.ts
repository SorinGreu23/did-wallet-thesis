import { Contract, JsonRpcProvider } from 'ethers';
import { CONFIG } from '../constants/config';
import AccreditationRegistryAbi from '../blockchain/abis/AccreditationRegistry.json';
import deploymentInfo from '../blockchain/deployments/latest.json';

// Scope enum from AccreditationRegistry.sol.
// Keep this in sync with the Solidity enum order.
export enum AccreditationScope {
  None = 0,
  MemberState = 1,
  Ministry = 2,
  Institution = 3,
  Department = 4,
  BusinessRegistry = 5,
  Enterprise = 6,
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

function toNumber(value: bigint | number | { toNumber?: () => number }): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (value?.toNumber) return value.toNumber();
  return Number(value);
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

  /**
   * Returns all accreditation IDs for a given subject address.
   */
  async getAccreditationsForSubject(address: string): Promise<string[]> {
    const contract = this.getContract();
    const ids = await contract.getAccreditationsBySubject(address.toLowerCase());

    return Array.from(ids);
  }

  /**
   * Returns a single accreditation record.
   */
  async getAccreditation(id: string): Promise<AccreditationRecord> {
    const contract = this.getContract();
    const raw = await contract.getAccreditation(id);

    return {
      id: raw.id,
      issuer: raw.issuer,
      subject: raw.subject,
      parentAccreditationId: raw.parentAccreditationId,
      scope: Number(raw.scope) as AccreditationScope,
      permissionsHash: raw.permissionsHash,
      issuedAt: toNumber(raw.issuedAt),
      expiresAt: toNumber(raw.expiresAt),
      revoked: raw.revoked,
      exists: raw.exists,
    };
  }

  /**
   * Validates the full trust chain for an accreditation ID.
   */
  async validateTrustChain(id: string): Promise<boolean> {
    const contract = this.getContract();
    return contract.validateTrustChain(id);
  }

  /**
   * Finds the first valid Institution-scope accreditation for a wallet address.
   * Used by the University gating step.
   */
  async findActiveInstitutionAccreditation(address: string): Promise<string | null> {
    if (!address) return null;

    const ids = await this.getAccreditationsForSubject(address);
    console.log(`[AccreditationLookup] found ${ids.length} accreditation(s) for ${address}`);

    for (const id of ids) {
      const record = await this.getAccreditation(id);
      console.log(`[AccreditationLookup] id=${id} scope=${record.scope} revoked=${record.revoked} exists=${record.exists} expiresAt=${record.expiresAt}`);

      if (
        record.exists &&
        !record.revoked &&
        record.scope === AccreditationScope.Institution &&
        (record.expiresAt === 0 || record.expiresAt > Date.now() / 1000)
      ) {
        const valid = await this.validateTrustChain(id);
        console.log(`[AccreditationLookup] validateTrustChain=${valid} for id=${id}`);
        if (valid) return id;
      }
    }

    return null;
  }

  /**
   * Finds the first valid BusinessRegistry-scope accreditation for a wallet address.
   * Useful for admin/client flows that need to identify a Chamber of Commerce.
   */
  async findActiveBusinessRegistryAccreditation(address: string): Promise<string | null> {
    try {
      if (!address) return null;

      const ids = await this.getAccreditationsForSubject(address);

      for (const id of ids) {
        const record = await this.getAccreditation(id);

        if (
          record.exists &&
          !record.revoked &&
          record.scope === AccreditationScope.BusinessRegistry &&
          (record.expiresAt === 0 || record.expiresAt > Date.now() / 1000)
        ) {
          const valid = await this.validateTrustChain(id);
          if (valid) return id;
        }
      }

      return null;
    } catch (e) {
      console.warn('Failed to find business registry accreditation', e);
      return null;
    }
  }

  /**
   * Finds the first valid Enterprise-scope accreditation for a wallet address.
   * Used by the Enterprise gating step.
   */
  async findActiveEnterpriseAccreditation(address: string): Promise<string | null> {
    try {
      if (!address) return null;

      const ids = await this.getAccreditationsForSubject(address);

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
    } catch (e) {
      console.warn('Failed to find enterprise accreditation', e);
      return null;
    }
  }
}

export default new AccreditationLookupService();
