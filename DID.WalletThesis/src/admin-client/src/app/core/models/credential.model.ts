export interface Credential {
  credentialId: string;
  issuerDID: string;
  holderDID: string;
  credentialType: string;
  issuerAccreditationId: string | null;
  issuerName?: string | null;
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
  issuerName?: string | null;
  expiresAt?: string | null;
}

export interface RecordCredentialRequest {
  txHash: string;
  issuerDID: string;
  holderDID: string;
  credentialType: string;
  credentialHash: string;
  issuerAccreditationId: string | null;
  issuerName: string | null;
}
