import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationStateService } from '../../../core/services/navigation-state.service';

@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav aria-label="Breadcrumb" class="flex items-center gap-1 text-sm">
      @for (crumb of navState.breadcrumbs(); track crumb.route; let last = $last) {
        @if (!last) {
          <a
            [routerLink]="crumb.route"
            class="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
          >
            {{ crumb.label }}
          </a>
          <span class="text-gray-400 select-none" aria-hidden="true">›</span>
        } @else {
          <span class="text-gray-700 font-semibold" aria-current="page">{{ crumb.label }}</span>
        }
      }
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly navState = inject(NavigationStateService);
}
