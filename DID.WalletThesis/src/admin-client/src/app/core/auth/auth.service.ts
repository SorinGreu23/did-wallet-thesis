import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthSession, AuthState, SCOPE_HIERARCHY } from './auth.models';
import { SignerService } from './signer.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly signer = inject(SignerService);

  readonly session = signal<AuthSession | null>(null);
  readonly state = signal<AuthState>('idle');
  readonly error = signal<string | null>(null);

  readonly scope = computed(() => this.session()?.scope ?? null);

  async login(privateKey: string): Promise<void> {
    try {
      this.error.set(null);

      // Step 1 — derive address and DID
      this.state.set('challenging');
      const address = this.signer.initialize(privateKey);
      const did = `did:ethr:sepolia:${address.toLowerCase()}`;

      // Step 2 — request challenge nonce
      const { nonce } = await firstValueFrom(
        this.http.post<{ nonce: string }>('/api/auth/challenge', { did }),
      );

      // Step 3 — sign the nonce locally
      this.state.set('signing');
      const signature = await this.signer.signMessage(nonce);

      // Step 4 — verify signature on backend
      this.state.set('verifying');
      const result = await firstValueFrom(
        this.http.post<{
          token: string;
          scope: AuthSession['scope'];
          accreditationId: string | null;
          expiresAt: string;
        }>('/api/auth/verify', { did, nonce, signature }),
      );

      // Step 5 — store session
      this.session.set({
        token: result.token,
        did,
        ethAddress: address,
        scope: result.scope,
        accreditationId: result.accreditationId,
        expiresAt: new Date(result.expiresAt),
      });

      this.state.set('authenticated');
    } catch (err: any) {
      this.state.set('error');
      this.signer.clear();

      const message =
        err?.error?.errors?.[0]?.message ??
        err?.error?.message ??
        err?.message ??
        'Authentication failed';
      this.error.set(message);

      throw err;
    }
  }

  logout(): void {
    this.session.set(null);
    this.state.set('idle');
    this.error.set(null);
    this.signer.clear();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  isAuthenticated(): boolean {
    const s = this.session();
    return s !== null && new Date() < s.expiresAt;
  }

  hasScope(requiredScope: string): boolean {
    const currentScope = this.session()?.scope;
    if (!currentScope) return false;
    return (SCOPE_HIERARCHY[currentScope] ?? 0) >= (SCOPE_HIERARCHY[requiredScope] ?? 0);
  }
}
