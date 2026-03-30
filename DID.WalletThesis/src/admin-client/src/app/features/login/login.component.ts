import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ethers } from 'ethers';

import { AuthService } from '../../core/auth/auth.service';
import { SignerService } from '../../core/auth/signer.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly signer = inject(SignerService);
  private readonly router = inject(Router);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = this.auth.state;
  readonly error = this.auth.error;

  privateKey = '';
  derivedDid = signal<string | null>(null);

  onKeyInput(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const key = this.privateKey.trim();
    const isFullKey = key.length === 64 || (key.startsWith('0x') && key.length === 66);

    if (!isFullKey) {
      this.derivedDid.set(null);
      return;
    }

    // Debounce to avoid creating ethers.Wallet on every keystroke during paste
    this.debounceTimer = setTimeout(() => {
      try {
        const address = ethers.computeAddress(key.startsWith('0x') ? key : `0x${key}`);
        this.derivedDid.set(`did:ethr:sepolia:${address.toLowerCase()}`);
      } catch {
        this.derivedDid.set(null);
      }
    }, 150);
  }

  async onSubmit(): Promise<void> {
    const key = this.privateKey.trim();
    if (!key) return;

    try {
      await this.auth.login(key);

      await this.router.navigateByUrl(this.auth.getHomeRoute());
    } catch {
      // error is already captured in auth.error signal
    }
  }
}
