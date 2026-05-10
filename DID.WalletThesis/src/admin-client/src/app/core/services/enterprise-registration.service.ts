import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EnterpriseRegistration {
  requestId: string;
  walletAddress: string;
  legalName: string;
  fiscalCode: string;
  countryCode: string;
  city: string;
  address: string;
  email: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  accreditationId?: string;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class EnterpriseRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/enterprise-registrations';

  list(countryCode?: string, status?: string): Observable<EnterpriseRegistration[]> {
    let params = new HttpParams();
    if (countryCode) params = params.set('countryCode', countryCode);
    if (status) params = params.set('status', status);
    return this.http.get<EnterpriseRegistration[]>(this.baseUrl, { params });
  }

  approve(requestId: string, accreditationId: string): Observable<EnterpriseRegistration> {
    return this.http.post<EnterpriseRegistration>(
      `${this.baseUrl}/${requestId}/approve`,
      { accreditationId },
    );
  }

  reject(requestId: string, reason: string): Observable<EnterpriseRegistration> {
    return this.http.post<EnterpriseRegistration>(
      `${this.baseUrl}/${requestId}/reject`,
      { reason },
    );
  }
}
