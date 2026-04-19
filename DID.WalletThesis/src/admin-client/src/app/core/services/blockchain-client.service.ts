import { inject, Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { SignerService } from '../auth/signer.service';
import { ConfigService } from './config.service';

/** Scope values must match AccreditationScope enum in AccreditationRegistry.sol */
const SCOPE_MAP: Record<string, number> = {
  MemberState: 1,
  Ministry: 2,
  Institution: 3,
  Department: 4,
};

const ACCREDITATION_REGISTRY_ABI = [
  'function issueAccreditation(address subject, uint8 scope, bytes32 parentAccreditationId, bytes32 permissionsHash, uint256 expiresAt) returns (bytes32)',
];

const CREDENTIAL_REGISTRY_ABI = [
  'function recordCredential(address holder, bytes32 credentialHash, string credentialType, bytes32 issuerAccreditationId, uint256 expiresAt) returns (bytes32)',
];

@Injectable({ providedIn: 'root' })
export class BlockchainClientService {
  private readonly signer = inject(SignerService);
  private readonly config = inject(ConfigService);

  /**
   * Signs and submits an `issueAccreditation` transaction directly from the
   * in-memory wallet — the private key never leaves the browser.
   *
   * @returns the transaction hash (not yet confirmed)
   */
  async issueAccreditation(
    subjectAddress: string,
    scope: string,
    parentAccreditationId: string | null,
  ): Promise<string> {
    const rpcUrl = this.config.rpcUrl();
    const contractAddress = this.config.accreditationRegistryAddress();

    if (!rpcUrl || !contractAddress) {
      throw new Error('Blockchain configuration not loaded yet');
    }

    const scopeValue = SCOPE_MAP[scope];
    if (scopeValue === undefined) {
      throw new Error(`Unknown accreditation scope: ${scope}`);
    }

    if (!this.signer.hasSigner()) {
      throw new Error('SIGNER_LOST');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = this.signer.getConnectedWallet(provider);

    const contract = new ethers.Contract(contractAddress, ACCREDITATION_REGISTRY_ABI, wallet);

    const parentBytes: string = parentAccreditationId
      ? (parentAccreditationId.startsWith('0x')
          ? parentAccreditationId.padEnd(66, '0')
          : `0x${parentAccreditationId}`.padEnd(66, '0'))
      : ethers.ZeroHash;

    const tx = await contract['issueAccreditation'](
      subjectAddress,
      scopeValue,
      parentBytes,
      ethers.ZeroHash, // permissionsHash — not used in the basic flow
      0,               // expiresAt — 0 means no expiry
    );

    return tx.hash as string;
  }

  /**
   * Signs and submits a `recordCredential` transaction directly from the
   * in-memory wallet — the private key never leaves the browser.
   *
   * @returns the transaction hash (not yet confirmed)
   */
  async recordCredential(
    holderAddress: string,
    credentialHash: string,
    credentialType: string,
    issuerAccreditationId: string | null,
    expiresAt: number = 0,
  ): Promise<string> {
    const rpcUrl = this.config.rpcUrl();
    const contractAddress = this.config.credentialRegistryAddress();

    if (!rpcUrl || !contractAddress) {
      throw new Error('Blockchain configuration not loaded yet');
    }

    if (!this.signer.hasSigner()) {
      throw new Error('SIGNER_LOST');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = this.signer.getConnectedWallet(provider);

    const contract = new ethers.Contract(contractAddress, CREDENTIAL_REGISTRY_ABI, wallet);

    const accreditationBytes: string = issuerAccreditationId
      ? (issuerAccreditationId.startsWith('0x')
          ? issuerAccreditationId.padEnd(66, '0')
          : `0x${issuerAccreditationId}`.padEnd(66, '0'))
      : ethers.ZeroHash;

    const tx = await contract['recordCredential'](
      holderAddress,
      credentialHash,
      credentialType,
      accreditationBytes,
      expiresAt,
    );

    return tx.hash as string;
  }
}
