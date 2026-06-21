import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthSession, AuthState, SCOPE_HIERARCHY } from './auth.models';
import { SignerService } from './signer.service';
import { NavigationStateService } from '../services/navigation-state.service';
import { extractApiError } from '../utils/api-error';

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
  readonly hasSigner = this.signer.hasSigner;
  readonly walletAvailable = this.signer.walletAvailable;

  constructor() {
    this.signer.providerEvents$.subscribe((event) => {
      const session = this.session();
      if (!session) return;

      if (event.type === 'disconnect') {
        this.logout();
        return;
      }

      if (event.type === 'accountsChanged') {
        const activeAccount = event.accounts[0];
        if (!activeAccount || activeAccount.toLowerCase() !== session.ethAddress.toLowerCase()) {
          this.logout();
          return;
        }

        void this.signer.restore(session.ethAddress);
      }
    });

    this.restoreSession();
  }

  async login(): Promise<void> {
    try {
      this.error.set(null);

      this.state.set('connecting');
      const address = await this.signer.connect();
      const did = `did:ethr:sepolia:${address.toLowerCase()}`;

      this.state.set('challenging');
      const { nonce } = await firstValueFrom(
        this.http.post<{ nonce: string }>('/api/auth/challenge', { did }),
      );

      this.state.set('signing');
      const signature = await this.signer.signMessage(nonce);

      this.state.set('verifying');
      const result = await firstValueFrom(
        this.http.post<{
          token: string;
          scope: AuthSession['scope'];
          accreditationId: string | null;
          expiresAt: string;
        }>('/api/auth/verify', { did, nonce, signature }),
      );

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
      this.state.set('authenticated');
    } catch (err: any) {
      this.state.set('error');
      this.signer.clear();

      const message = extractApiError(err, 'Authentication failed');
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

  async connectSigner(): Promise<void> {
    const session = this.session();
    if (!session) throw new Error('No authenticated session');
    await this.signer.connect(true, session.ethAddress);
  }

  getHomeRoute(): string {
    switch (this.session()?.scope) {
      case 'EURoot':
        return '/member-states';
      case 'MemberState':
        return '/government';
      case 'Ministry':
      case 'Institution':
        return '/universities';
      case 'BusinessRegistry':
        return '/enterprises';
      default:
        return '/login';
    }
  }

  private saveSession(s: AuthSession): void {
    if (!this.isBrowser) return;
    sessionStorage.setItem(
      AuthService.STORAGE_KEY,
      JSON.stringify({ ...s, expiresAt: s.expiresAt.toISOString() }),
    );
  }

  private clearSession(): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(AuthService.STORAGE_KEY);
    // Remove any legacy values from localStorage or sessionStorage.
    localStorage.removeItem(AuthService.STORAGE_KEY);
    sessionStorage.removeItem('auth_signer');
  }

  private restoreSession(): void {
    if (!this.isBrowser) return;
    try {
      const raw = sessionStorage.getItem(AuthService.STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const expiresAt = new Date(parsed.expiresAt);

      if (expiresAt <= new Date()) {
        this.clearSession();
        return;
      }

      this.session.set({ ...parsed, expiresAt });
      this.state.set('authenticated');
      void this.signer.restore(parsed.ethAddress);
    } catch {
      this.clearSession();
    }
  }
}
