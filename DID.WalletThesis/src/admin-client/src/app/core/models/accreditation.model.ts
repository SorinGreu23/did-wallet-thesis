export interface Accreditation {
  accreditationId: string;
  issuerDID: string;
  subjectDID: string;
  parentAccreditationId: string | null;
  scope: string;
  name: string | null;
  status: string;
  blockNumber: number;
  transactionHash: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedByDID: string | null;
}

export interface AccreditationVerification {
  accreditationId: string;
  isValid: boolean;
  status: string;
  reason: string | null;
}

export interface IssueAccreditationRequest {
  issuerDID: string;
  subjectDID: string;
  scope: string;
  name: string | null;
  parentAccreditationId: string | null;
  permissionsHash?: string | null;
  expiresAt?: string | null;
}

export interface RecordAccreditationRequest {
  txHash: string;
  issuerDID: string;
  subjectDID: string;
  scope: string;
  name: string | null;
  parentAccreditationId: string | null;
}
