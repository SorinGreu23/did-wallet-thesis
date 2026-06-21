import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly state = this.auth.state;
  readonly error = this.auth.error;
  readonly walletAvailable = this.auth.walletAvailable;

  async onSubmit(): Promise<void> {
    try {
      await this.auth.login();
      await this.router.navigateByUrl(this.auth.getHomeRoute());
    } catch (err) {
      if (!this.auth.error()) {
        this.auth.error.set(err instanceof Error ? err.message : 'MetaMask login failed');
      }
    }
  }
}
