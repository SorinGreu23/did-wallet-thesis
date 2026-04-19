import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { Accreditation, AccreditationVerification, IssueAccreditationRequest, RecordAccreditationRequest } from '../models/accreditation.model';
import { BlockchainClientService } from './blockchain-client.service';

@Injectable({ providedIn: 'root' })
export class AccreditationService {
  private readonly http = inject(HttpClient);
  private readonly blockchainClient = inject(BlockchainClientService);
  private readonly baseUrl = '/api/accreditations';

  list(issuerDid?: string, subjectDid?: string, scope?: string): Observable<Accreditation[]> {
    let params = new HttpParams();
    if (issuerDid) params = params.set('issuerDid', issuerDid);
    if (subjectDid) params = params.set('subjectDid', subjectDid);
    if (scope) params = params.set('scope', scope);
    return this.http.get<Accreditation[]>(this.baseUrl, { params });
  }

  get(accreditationId: string): Observable<Accreditation> {
    return this.http.get<Accreditation>(`${this.baseUrl}/${accreditationId}`);
  }

  /** EU Root operations: backend holds the signing key and submits the tx itself. */
  issue(request: IssueAccreditationRequest): Observable<Accreditation> {
    return this.http.post<Accreditation>(this.baseUrl, request);
  }

  /**
   * Non-EU-Root issuers (member states, ministries): the wallet signs and submits
   * the transaction entirely in the browser, then notifies the backend to persist.
   */
  issueViaClientWallet(
    issuerDID: string,
    subjectAddress: string,
    scope: string,
    name: string | null,
    parentAccreditationId: string | null,
  ): Observable<Accreditation> {
    const subjectDID = `did:ethr:sepolia:${subjectAddress.toLowerCase()}`;
    return from(
      this.blockchainClient.issueAccreditation(subjectAddress, scope, parentAccreditationId),
    ).pipe(
      switchMap((txHash) => {
        const recordRequest: RecordAccreditationRequest = {
          txHash,
          issuerDID,
          subjectDID,
          scope,
          name,
          parentAccreditationId,
        };
        return this.http.post<Accreditation>(`${this.baseUrl}/record`, recordRequest);
      }),
    );
  }

  verify(accreditationId: string): Observable<AccreditationVerification> {
    return this.http.get<AccreditationVerification>(`${this.baseUrl}/${accreditationId}/verify`);
  }

  revoke(accreditationId: string, revokedByDID: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${accreditationId}`, {
      body: { revokedByDID },
    });
  }
}
