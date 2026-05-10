// ─── Base64url helpers (React Native does not support 'base64url' encoding natively) ─

function toBase64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return decodeURIComponent(escape(atob(padded + '='.repeat(padLen))));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresentationPurpose =
  | 'master-application'
  | 'foreign-id-card'
  | 'job-application';

export type ZkpCircuit = 'ageVerification' | 'graduationYearRange' | 'countryMembership';

export type Requirement =
  | { kind: 'zkp'; circuit: 'ageVerification'; threshold: number }
  | { kind: 'zkp'; circuit: 'graduationYearRange'; minYear: number; maxYear: number }
  | { kind: 'zkp'; circuit: 'countryMembership'; merkleRoot: string }
  | { kind: 'credential-ref'; credentialType: string; mustBeIssuedInEu?: boolean }
  | { kind: 'full-disclosure'; credentialType: string };

export interface PresentationRequest {
  id: string;
  verifierDid: string;
  purpose: PresentationPurpose;
  challenge: string;
  expiresAt: string;
  requirements: Requirement[];
  callbackUrl?: string;
}

export interface ZkpProof {
  circuit: ZkpCircuit;
  proof: any;
  publicSignals: string[];
}

export interface CredentialRef {
  credentialType: string;
  credentialHash: string;
  issuerAccreditationId: string;
}

export interface PresentationResponse {
  requestId: string;
  holderDid: string;
  proofs: ZkpProof[];
  credentialRefs: CredentialRef[];
  fullDisclosures?: Array<{ credentialType: string; credential: any }>;
  signature: string;
  submittedAt: string;
}

// ─── Encode / Decode ──────────────────────────────────────────────────────────

export function encodePresentationRequest(req: PresentationRequest): string {
  const json = JSON.stringify(req);
  const b64 = toBase64url(json);
  return `eudi-pres://${b64}`;
}

export function decodePresentationRequest(encoded: string): PresentationRequest {
  const b64 = encoded.replace('eudi-pres://', '');
  const json = fromBase64url(b64);
  return JSON.parse(json);
}
