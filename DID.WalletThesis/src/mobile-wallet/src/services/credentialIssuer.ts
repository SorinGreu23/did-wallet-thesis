import { keccak256, toUtf8Bytes } from 'ethers';
import credentialService, { CredentialData } from './credentialService';

class CredentialIssuer {
  async issue(params: {
    issuerDid: string;
    holderDid: string;
    credentialType: string;
    subject: Record<string, any>;
    issuerAccreditationId: string;
    expirationDate: string;
  }): Promise<{ vc: any; vcHash: string }> {
    const credentialData: CredentialData = {
      type: ['VerifiableCredential', params.credentialType],
      credentialSubject: {
        ...params.subject,
        issuerAccreditationId: params.issuerAccreditationId,
      },
      expirationDate: params.expirationDate,
    };
    const vc = await credentialService.issueCredential(
      params.issuerDid,
      params.holderDid,
      credentialData,
    );
    const vcJson = JSON.stringify(vc);
    const vcHash = keccak256(toUtf8Bytes(vcJson));
    return { vc, vcHash };
  }
}

export default new CredentialIssuer();
