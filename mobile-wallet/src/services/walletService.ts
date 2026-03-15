import { VerifiableCredential } from '@veramo/core-types';
import credentialService, { CredentialData } from './credentialService';
import didService, { DIDInfo } from './didService';
import storageService from './storageService';

class WalletService {
  async listDIDs(): Promise<DIDInfo[]> {
    return didService.listDIDs();
  }

  async createDID(alias?: string): Promise<DIDInfo> {
    const didInfo = await didService.createDID(alias);
    await storageService.setActiveDid(didInfo.did);
    return didInfo;
  }

  async getDID(did: string): Promise<DIDInfo | null> {
    return didService.getDID(did);
  }

  async resolveDID(did: string): Promise<any> {
    return didService.resolveDID(did);
  }

  async listCredentials() {
    return credentialService.listCredentials();
  }

  async getCredential(hash: string) {
    return credentialService.getCredential(hash);
  }

  async verifyCredential(credential: VerifiableCredential) {
    return credentialService.verifyCredential(credential);
  }

  async getActiveDid(): Promise<DIDInfo | null> {
    const activeDid = await storageService.getActiveDid();
    if (activeDid) {
      const didInfo = await didService.getDID(activeDid);
      if (didInfo) {
        return didInfo;
      }
      await storageService.clearActiveDid();
    }

    const dids = await didService.listDIDs();
    if (dids.length === 0) {
      return null;
    }

    await storageService.setActiveDid(dids[0].did);
    return dids[0];
  }

  async setActiveDid(did: string): Promise<void> {
    await storageService.setActiveDid(did);
  }

  async isActiveDid(did: string): Promise<boolean> {
    const activeDid = await storageService.getActiveDid();
    return activeDid === did;
  }

  async issueCredentialWithActiveDid(credentialData: CredentialData) {
    const activeDid = await this.getActiveDid();
    if (!activeDid) {
      throw new Error('No active DID selected. Create or select a DID first.');
    }

    return credentialService.issueCredential(
      activeDid.did,
      activeDid.did,
      credentialData,
    );
  }
}

export default new WalletService();