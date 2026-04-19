import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthSession, AuthState, SCOPE_HIERARCHY } from './auth.models';
import { SignerService } from './signer.service';
import { NavigationStateService } from '../services/navigation-state.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly STORAGE_KEY = 'auth_session';

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly signer = inject(SignerService);
  private readonly navigationState = inject(NavigationStateService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly session = signal<AuthSession | null>(null);
  readonly state = signal<AuthState>('idle');
  readonly error = signal<string | null>(null);

  readonly scope = computed(() => this.session()?.scope ?? null);

  constructor() {
    this.restoreSession();
  }

  async login(privateKey: string): Promise<void> {
    try {
      this.error.set(null);

      // Step 1 — derive address and DID
      this.state.set('challenging');
      const address = await this.signer.initialize(privateKey);
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
      const authSession: AuthSession = {
        token: result.token,
        did,
        ethAddress: address,
        scope: result.scope,
        accreditationId: result.accreditationId,
        expiresAt: new Date(result.expiresAt),
      };

      this.navigationState.resetToRoot();
      this.session.set(authSession);
      this.saveSession(authSession);
      this.saveSignerKey(privateKey);

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
    this.navigationState.resetToRoot();
    this.clearSession();
    this.clearSignerKey();
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

  getHomeRoute(): string {
    switch (this.session()?.scope) {
      case 'EURoot':
        return '/member-states';
      case 'MemberState':
        return '/ministries';
      case 'Ministry':
      case 'Institution':
        return '/universities';
      default:
        return '/login';
    }
  }

  private saveSession(s: AuthSession): void {
    if (!this.isBrowser) return;
    localStorage.setItem(
      AuthService.STORAGE_KEY,
      JSON.stringify({ ...s, expiresAt: s.expiresAt.toISOString() }),
    );
  }

  private clearSession(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(AuthService.STORAGE_KEY);
  }

  private static readonly SIGNER_KEY = 'auth_signer';

  private saveSignerKey(key: string): void {
    if (!this.isBrowser) return;
    sessionStorage.setItem(AuthService.SIGNER_KEY, key);
  }

  private clearSignerKey(): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(AuthService.SIGNER_KEY);
  }

  private restoreSession(): void {
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem(AuthService.STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const expiresAt = new Date(parsed.expiresAt);

      if (expiresAt <= new Date()) {
        this.clearSession();
        this.clearSignerKey();
        return;
      }

      this.session.set({ ...parsed, expiresAt });
      this.state.set('authenticated');

      // Restore the in-memory signer from sessionStorage (survives refresh, not tab close)
      const signerKey = sessionStorage.getItem(AuthService.SIGNER_KEY);
      if (signerKey) {
        void this.signer.initialize(signerKey);
      }
    } catch {
      this.clearSession();
      this.clearSignerKey();
    }
  }
}
