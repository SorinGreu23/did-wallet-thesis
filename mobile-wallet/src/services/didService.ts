import { IKey } from "@veramo/core-types";
import { getAgent, initializeAgent } from "../agents/veramoAgent";

export interface DIDInfo {
  did: string;
  provider: string;
  alias?: string;
  keys: Array<{
    kid: string;
    type: string;
    publicKeyHex: string;
  }>;
}

class DIDService {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      await initializeAgent();
      this.initialized = true;
    }
  }

  async createDID(alias?: string): Promise<DIDInfo> {
    await this.initialize();
    const agent = getAgent();

    const identifier = await agent.didManagerCreate({
      provider: 'did:key',
      alias: alias || `did-${Date.now()}`,
    });

    return {
      did: identifier.did,
      provider: identifier.provider,
      alias: identifier.alias,
      keys: identifier.keys.map((key) => ({
        kid: key.kid,
        type: key.type,
        publicKeyHex: key.publicKeyHex
      })),
    };
  }

  async listDIDs(): Promise<DIDInfo[]> {
    await this.initialize();
    const agent = getAgent();

    const identifiers = await agent.didManagerFind();

    return identifiers.map((id: any) => ({
      did: id.did,
      provider: id.provider,
      alias: id.alias,
      keys: id.keys.map((key: IKey) => ({
        kid: key.kid,
        type: key.type,
        publicKeyHex: key.publicKeyHex,
      })),
    }));
  }

  async getDID(did: string): Promise<DIDInfo | null> {
    await this.initialize();
    const agent = getAgent();

    try {
      const identifier = await agent.didManagerGet({did});
      return {
        did: identifier.did,
        provider: identifier.provider,
        alias: identifier.alias,
        keys: identifier.keys.map((key) => ({
          kid: key.kid,
          type: key.type,
          publicKeyHex: key.publicKeyHex,
        })),
      };
    } catch (error) {
      console.error('DID not found:', error);
      return null;
    }
  }

  async deleteDID(did: string): Promise<boolean> {
    await this.initialize();
    const agent = getAgent();

    try {
      await agent.didManagerDelete({ did });
      return true;
    } catch (error) {
      console.error('Error deleting DID:', error);
      return false;
    }
  }

  async resolveDID(did: string): Promise<any> {
    await this.initialize();
    const agent = getAgent();

    try {
      const resolution = await agent.resolveDid({didUrl: did});
      return resolution;
    } catch (error) {
      console.log('Error resolving DID:', error);
      throw error;
    }
  }
}

export default new DIDService();