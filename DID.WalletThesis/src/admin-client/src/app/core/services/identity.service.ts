import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateDIDRequest, DIDDocument } from '../models/did.model';

@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/dids';

  create(request: CreateDIDRequest): Observable<DIDDocument> {
    return this.http.post<DIDDocument>(this.baseUrl, request);
  }

  resolve(did: string): Observable<DIDDocument> {
    return this.http.get<DIDDocument>(`${this.baseUrl}/${encodeURIComponent(did)}`);
  }
}