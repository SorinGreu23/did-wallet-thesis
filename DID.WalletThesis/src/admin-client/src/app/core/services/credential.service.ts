import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Credential, IssueCredentialRequest } from '../models/credential.model';

@Injectable({ providedIn: 'root' })
export class CredentialService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/credentials';

  issue(request: IssueCredentialRequest): Observable<Credential> {
    return this.http.post<Credential>(this.baseUrl, request);
  }

  listByHolder(holderDid: string): Observable<Credential[]> {
    const params = new HttpParams().set('holderDid', holderDid);
    return this.http.get<Credential[]>(this.baseUrl, { params });
  }

  listByIssuer(issuerDid: string): Observable<Credential[]> {
    const params = new HttpParams().set('issuerDid', issuerDid);
    return this.http.get<Credential[]>(this.baseUrl, { params });
  }

  revoke(credentialId: string, revokedByDID: string, reason: string, revokedByPrivateKey: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${credentialId}/revoke`, {
      credentialId, revokedByDID, reason, revokedByPrivateKey,
    });
  }
}
