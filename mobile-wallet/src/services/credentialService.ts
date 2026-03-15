import {
  VerifiableCredential,
  VerifiablePresentation,
} from "@veramo/core-types";
import { getAgent, initializeAgent } from "../agents/veramoAgent";

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

class CredentialService {
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      await initializeAgent();
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
  ): Promise<{ verified: boolean; error?: string }> {
    await this.initialize();
    const agent = getAgent();

    try {
      const result = await agent.verifyCredential({
        credential,
      });
      return { verified: result.verified };
    } catch (error: any) {
      return { verified: false, error: error.message };
    }
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
      `http://localhost:5214/api/credentials?holderDid=${encoded}`,
    );
    if (!response.ok) throw new Error(`Backend returned ${response.status} for ${holderDid}`);

    const credentials: any[] = await response.json();

    // Remove previously synced on-chain credentials so status updates are reflected
    const existing = await agent.dataStoreORMGetVerifiableCredentials();
    for (const stored of existing) {
      const proof = stored.verifiableCredential.proof as any;
      if (proof?.type === "EthereumOnChainProof") {
        try {
          await agent.dataStoreDeleteVerifiableCredential({ hash: stored.hash });
        } catch { /* ignore */ }
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
          issuerAccreditationId: cred.issuerAccreditationId,
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
      } catch { /* ignore */ }
    }

    return credentials.length;
  }
}

export default new CredentialService();
