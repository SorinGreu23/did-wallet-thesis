export interface Credential {
  credentialId: string;
  issuerDID: string;
  holderDID: string;
  credentialType: string;
  issuerAccreditationId: string | null;
  status: string;
  blockNumber: number;
  transactionHash: string;
  issuedAt: string;
  revokedAt: string | null;
}

export interface IssueCredentialRequest {
  issuerDID: string;
  holderDID: string;
  credentialType: string;
  credentialHash: string;
  issuerAccreditationId: string;
  expiresAt?: string | null;
  issuerPrivateKey: string;
}
