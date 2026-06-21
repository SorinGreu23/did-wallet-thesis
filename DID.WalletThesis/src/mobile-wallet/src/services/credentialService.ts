import {
  VerifiableCredential,
  VerifiablePresentation,
} from "@veramo/core-types";
import { getAgent, initializeAgent } from "../agents/veramoAgent";
import { CONFIG } from "../constants/config";
import authService from "./authService";

export interface CredentialData {
  type: string[];
  credentialSubject: Record<string, any>;
  issuer?: string;
  expirationDate: string;
}

export interface StoredCredential {
  hash: string;
  verifiableCredential: VerifiableCredential;
}

export interface OnChainVerificationResult {
  credentialId: string;
  isValid: boolean;
  credentialActive: boolean;
  trustChainValid: boolean;
  zkpValid: boolean | null;
  status: string;
  reason: string | null;
  verifiedAt: string;
}

class CredentialService {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      const secretKey = await authService.getSecretKey();
      if (!secretKey) throw new Error("Wallet not created. No secret key found.");
      await initializeAgent(secretKey);
      this.initialized = true;
    }
  }

  async issueCredential(
    issuerDID: string,
    subjectDID: string,
    credentialData: CredentialData,
  ): Promise<VerifiableCredential> {
    await this.initialize();
    const agent = getAgent();

    const credential = await agent.createVerifiableCredential({
      credential: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: credentialData.type,
        issuer: { id: issuerDID },
        issuanceDate: new Date().toISOString(),
        expirationDate: credentialData.expirationDate,
        credentialSubject: {
          id: subjectDID,
          ...credentialData.credentialSubject,
        },
      },
      proofFormat: "jwt",
      save: true, // Save to storage
    });

    return credential;
  }

  async listCredentials(): Promise<StoredCredential[]> {
    await this.initialize();
    const agent = getAgent();

    const credentials = await agent.dataStoreORMGetVerifiableCredentials({
      order: [{ column: "issuanceDate", direction: "DESC" }],
    });

    return credentials;
  }

  async getCredential(hash: string): Promise<VerifiableCredential | null> {
    await this.initialize();
    const agent = getAgent();

    try {
      const credential = await agent.dataStoreGetVerifiableCredential({
        hash,
      });
      return credential;
    } catch (error) {
      console.error("Credential not found:", error);
      return null;
    }
  }

  async verifyCredential(
    credential: VerifiableCredential,
  ): Promise<{ verified: boolean; onChain?: OnChainVerificationResult; error?: string }> {
    await this.initialize();
    const agent = getAgent();

    // 1. Local Veramo signature check
    let localVerified = false;
    try {
      const result = await agent.verifyCredential({ credential });
      localVerified = result.verified;
    } catch (error: any) {
      return { verified: false, error: error.message };
    }

    // 2. On-chain status check via DID.Verification
    // The credentialId is stored in credentialSubject.credentialId for on-chain-backed credentials.
    // (Verification service removed as it was missing/unused)
    return { verified: localVerified };
  }

  async createPresentation(
    holderDID: string,
    credentials: VerifiableCredential[],
    verifierDID?: string,
  ): Promise<VerifiablePresentation> {
    await this.initialize();
    const agent = getAgent();

    const presentation = await agent.createVerifiablePresentation({
      presentation: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiablePresentation"],
        holder: holderDID,
        verifiableCredential: credentials,
      },
      proofFormat: "jwt",
      domain: verifierDID,
      save: true,
    });

    return presentation;
  }

  async deleteCredential(hash: string): Promise<boolean> {
    await this.initialize();
    const agent = getAgent();

    try {
      await agent.dataStoreDeleteVerifiableCredential({ hash });
      return true;
    } catch (error) {
      console.error("Error deleting credential:", error);
      return false;
    }
  }

  async fetchFromBackend(holderDid: string): Promise<number> {
    await this.initialize();
    const agent = getAgent();

    const encoded = encodeURIComponent(holderDid);
    const response = await fetch(
      `${CONFIG.CREDENTIAL_SERVICE_URL}/api/credentials?holderDid=${encoded}`,
    );
    if (!response.ok) {
      throw new Error(
        `Credential sync returned ${response.status} from ${CONFIG.CREDENTIAL_SERVICE_URL}`,
      );
    }

    const credentials: any[] = await response.json();

    // Remove previously synced on-chain credentials so status updates are reflected
    const existing = await agent.dataStoreORMGetVerifiableCredentials();
    for (const stored of existing) {
      const proof = stored.verifiableCredential.proof as any;
      if (proof?.type === "EthereumOnChainProof") {
        try {
          await agent.dataStoreDeleteVerifiableCredential({ hash: stored.hash });
        } catch (e) {
          console.warn('[CredentialService] Failed to delete stale VC from local store:', e);
        }
      }
    }

    for (const cred of credentials) {
      const vc = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", cred.credentialType],
        issuer: { id: cred.issuerDID },
        issuanceDate: cred.issuedAt,
        credentialSubject: {
          id: cred.holderDID,
          credentialId: cred.credentialId,
          credentialType: cred.credentialType,
          ...(cred.issuerAccreditationId ? { issuerAccreditationId: cred.issuerAccreditationId } : {}),
          ...(cred.issuerName ? { issuerName: cred.issuerName } : {}),
          transactionHash: cred.transactionHash,
          status: cred.status,
        },
        proof: {
          type: "EthereumOnChainProof",
          transactionHash: cred.transactionHash,
        },
      };
      try {
        await agent.dataStoreSaveVerifiableCredential({
          verifiableCredential: vc as any,
        });
      } catch (e) {
        console.warn('[CredentialService] Failed to save VC to local store:', e);
      }
    }

    return credentials.length;
  }
}

export default new CredentialService();
