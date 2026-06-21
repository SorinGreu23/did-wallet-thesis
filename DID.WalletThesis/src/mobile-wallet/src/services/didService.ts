import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { computePublicKey } from "@ethersproject/signing-key";
import { getAddress } from "ethers";
import { getAgent, initializeAgent } from "../agents/veramoAgent";
import authService from "./authService";
import { CONFIG } from "../constants/config";

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
      if (!secretKey)
        throw new Error("Wallet not created. No secret key found.");
      await initializeAgent(secretKey);
      this.initialized = true;
    }
  }

  async getOrCreateIdentity(): Promise<DIDInfo> {
    await this.initialize();
    const agent = getAgent();

    const existing = await agent.didManagerFind({
      alias: WALLET_IDENTITY_ALIAS,
    });
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

  async getDID(did: string): Promise<DIDInfo> {
    await this.initialize();
    const agent = getAgent();
    const id = await agent.didManagerGet({ did });
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

  async updateRegisteredProfile(
    did: string,
    controllerAddress: string,
    displayName: string,
    email: string,
  ): Promise<void> {
    const identity = await this.getDID(did);
    const kid = identity.keys[0]?.kid;
    if (!kid) throw new Error("No signing key is available for this identity");

    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${controllerAddress.toLowerCase()}:${timestamp}`;
    const signature = await getAgent().keyManagerSign({
      keyRef: kid,
      data: message,
      algorithm: "eth_signMessage",
      encoding: "utf-8",
    });

    const response = await fetch(
      `${CONFIG.IDENTITY_SERVICE_URL}/api/identities/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          did,
          controllerAddress,
          displayName,
          email,
          accountType: "personal",
          timestamp,
          signature,
        }),
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message =
        payload?.errors && typeof payload.errors === "object"
          ? Object.values(payload.errors).flat().find(Boolean)
          : payload?.message;
      throw new Error(
        typeof message === "string"
          ? message
          : `Profile update failed (${response.status})`,
      );
    }
  }
}

export default new DIDService();
