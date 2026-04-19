import { getAddress } from "@ethersproject/address";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { computePublicKey } from "@ethersproject/signing-key";
import { getAgent, initializeAgent } from "../agents/veramoAgent";
import authService from "./authService";

export interface DIDInfo {
  did: string;
  ethereumAddress: string; // proper 20-byte checksum address derived from the key
  provider: string;
  alias?: string;
  keys: Array<{
    kid: string;
    type: string;
    publicKeyHex: string;
  }>;
}

function deriveEthereumAddress(did: string): string {
  const raw = did.split(":").pop()!;
  if (raw.length === 42) return getAddress(raw); // already a 20-byte address
  const uncompressed = computePublicKey(raw, false);
  const hash = keccak256(arrayify(uncompressed).slice(1));
  return getAddress("0x" + hash.slice(-40));
}

const WALLET_IDENTITY_ALIAS = "wallet-identity";

class DIDService {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      const secretKey = await authService.getSecretKey();
      if (!secretKey) throw new Error("Wallet not created. No secret key found.");
      await initializeAgent(secretKey);
      this.initialized = true;
    }
  }

  async getOrCreateIdentity(): Promise<DIDInfo> {
    await this.initialize();
    const agent = getAgent();

    const existing = await agent.didManagerFind({ alias: WALLET_IDENTITY_ALIAS });
    if (existing.length > 0) {
      const id = existing[0];
      return {
        did: id.did,
        ethereumAddress: deriveEthereumAddress(id.did),
        provider: id.provider,
        alias: id.alias,
        keys: id.keys.map((k) => ({
          kid: k.kid,
          type: k.type,
          publicKeyHex: k.publicKeyHex,
        })),
      };
    }

    const identifier = await agent.didManagerCreate({
      provider: "did:ethr:sepolia",
      alias: WALLET_IDENTITY_ALIAS,
    });

    return {
      did: identifier.did,
      ethereumAddress: deriveEthereumAddress(identifier.did),
      provider: identifier.provider,
      alias: identifier.alias,
      keys: identifier.keys.map((k) => ({
        kid: k.kid,
        type: k.type,
        publicKeyHex: k.publicKeyHex,
      })),
    };
  }

  async resolveDID(did: string): Promise<any> {
    await this.initialize();
    const agent = getAgent();
    return agent.resolveDid({ didUrl: did });
  }
}

export default new DIDService();
