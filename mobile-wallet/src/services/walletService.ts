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
