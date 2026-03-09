export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyHex: string;
}

export interface DIDDocument {
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  created: string;
}

export interface CreateDIDRequest {
  controllerAddress: string;
}