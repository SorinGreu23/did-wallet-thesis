import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SCOPE_HIERARCHY } from '../../core/auth/auth.models';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly stars = Array(12).fill(0);

  get truncatedDid(): string {
    const did = this.auth.session()?.did;
    if (!did) return '';
    return did.length > 30 ? did.slice(0, 20) + '...' + did.slice(-8) : did;
  }

  canAccess(minimumScope: string): boolean {
    return this.auth.hasScope(minimumScope);
  }

  isScope(...scopes: string[]): boolean {
    const current = this.auth.scope();
    return current !== null && scopes.includes(current);
  }

  scopeLabel(): string {
    const scope = this.auth.scope();
    if (!scope) return '';
    const labels: Record<string, string> = {
      EURoot: 'EU Root',
      MemberState: 'Member State',
      Ministry: 'Ministry',
      Institution: 'Institution',
    };
    return labels[scope] ?? scope;
  }

  scopeBadgeClasses(): string {
    const scope = this.auth.scope();
    switch (scope) {
      case 'EURoot':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'MemberState':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Ministry':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Institution':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
