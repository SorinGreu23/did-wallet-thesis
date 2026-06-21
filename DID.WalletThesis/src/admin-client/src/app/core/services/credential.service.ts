import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { Credential, IssueCredentialRequest, RecordCredentialRequest } from '../models/credential.model';
import { BlockchainClientService } from './blockchain-client.service';

@Injectable({ providedIn: 'root' })
export class CredentialService {
  private readonly http = inject(HttpClient);
  private readonly blockchainClient = inject(BlockchainClientService);
  private readonly baseUrl = '/api/credentials';

  /** Backend-signed issuance (EU Root only). */
  issue(request: IssueCredentialRequest): Observable<Credential> {
    return this.http.post<Credential>(this.baseUrl, request);
  }

  /**
   * Institution issuers (universities): the wallet signs and submits
   * the transaction entirely in the browser, then notifies the backend to persist.
   */
  issueViaClientWallet(
    issuerDID: string,
    holderAddress: string,
    credentialType: string,
    credentialHash: string,
    issuerAccreditationId: string | null,
    issuerName: string | null,
  ): Observable<Credential> {
    const holderDID = `did:ethr:sepolia:${holderAddress.toLowerCase()}`;
    return from(
      this.blockchainClient.recordCredential(
        holderAddress,
        credentialHash,
        credentialType,
        issuerAccreditationId,
      ),
    ).pipe(
      switchMap((txHash) => {
        const recordRequest: RecordCredentialRequest = {
          txHash,
          issuerDID,
          holderDID,
          credentialType,
          credentialHash,
          issuerAccreditationId,
          issuerName,
        };
        return this.http.post<Credential>(`${this.baseUrl}/record`, recordRequest);
      }),
    );
  }

  listByHolder(holderDid: string): Observable<Credential[]> {
    const params = new HttpParams().set('holderDid', holderDid);
    return this.http.get<Credential[]>(this.baseUrl, { params });
  }

  listByIssuer(issuerDid: string): Observable<Credential[]> {
    const params = new HttpParams().set('issuerDid', issuerDid);
    return this.http.get<Credential[]>(this.baseUrl, { params });
  }

  /**
   * Institution revokers (universities): the wallet signs and submits
   * the revocation transaction entirely in the browser, then notifies the backend to persist.
   */
  revokeViaClientWallet(credentialId: string, revokedByDID: string, reason: string): Observable<void> {
    return from(this.blockchainClient.revokeCredential(credentialId, reason)).pipe(
      switchMap((txHash) =>
        this.http.post<void>(`${this.baseUrl}/${credentialId}/record-revoke`, {
          txHash,
          revokedByDID,
          reason,
        }),
      ),
    );
  }
}
