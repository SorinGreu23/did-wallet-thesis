import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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

  readonly state = this.auth.state;
  readonly error = this.auth.error;

  privateKey = '';
  derivedDid = signal<string | null>(null);

  onKeyInput(): void {
    const key = this.privateKey.trim();
    if (key.length === 64 || (key.startsWith('0x') && key.length === 66)) {
      try {
        const address = this.signer.initialize(key);
        this.derivedDid.set(`did:ethr:sepolia:${address.toLowerCase()}`);
        this.signer.clear();
      } catch {
        this.derivedDid.set(null);
      }
    } else {
      this.derivedDid.set(null);
    }
  }

  async onSubmit(): Promise<void> {
    const key = this.privateKey.trim();
    if (!key) return;

    try {
      await this.auth.login(key);

      const scope = this.auth.scope();
      switch (scope) {
        case 'EURoot':
          this.router.navigate(['/member-states']);
          break;
        case 'MemberState':
          this.router.navigate(['/ministries']);
          break;
        case 'Ministry':
        case 'Institution':
          this.router.navigate(['/universities']);
          break;
        default:
          this.router.navigate(['/']);
      }
    } catch {
      // error is already captured in auth.error signal
    }
  }
}
