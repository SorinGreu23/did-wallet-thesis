import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Accreditation, AccreditationVerification, IssueAccreditationRequest } from '../models/accreditation.model';

@Injectable({ providedIn: 'root' })
export class AccreditationService {
  private readonly http = inject(HttpClient);
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

  issue(request: IssueAccreditationRequest): Observable<Accreditation> {
    return this.http.post<Accreditation>(this.baseUrl, request);
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
