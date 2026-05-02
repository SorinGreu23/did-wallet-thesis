import { VerifiableCredential } from "@veramo/core-types";
import credentialService, { CredentialData } from "./credentialService";
import didService, { DIDInfo } from "./didService";

class WalletService {
  async getIdentity(): Promise<DIDInfo> {
    return didService.getOrCreateIdentity();
  }

  async resolveDID(did: string): Promise<any> {
    return didService.resolveDID(did);
  }

  /** Returns true if the given DID is the wallet's primary identity. */
  async isActiveDid(did: string): Promise<boolean> {
    const identity = await didService.getOrCreateIdentity();
    return identity.did === did;
  }

  /** No-op: with a single-identity wallet there is only one active DID. */
  async setActiveDid(_did: string): Promise<void> {
    // single-identity model — nothing to switch
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
}

export default new WalletService();
