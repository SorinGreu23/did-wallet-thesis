import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-tx-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 flex-shrink-0">
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-green-800">Accreditation issued on-chain</p>
          <dl class="mt-2 space-y-1">
            <div class="flex gap-2">
              <dt class="text-xs font-medium text-green-700 shrink-0">TX Hash:</dt>
              <dd class="text-xs font-mono text-green-800 break-all">{{ txHash() }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="text-xs font-medium text-green-700 shrink-0">Block:</dt>
              <dd class="text-xs font-mono text-green-800">{{ blockNumber() }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="text-xs font-medium text-green-700 shrink-0">Accreditation ID:</dt>
              <dd class="text-xs font-mono text-green-800 break-all">{{ accreditationId() }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  `,
})
export class TxBadgeComponent {
  readonly txHash = input.required<string>();
  readonly blockNumber = input.required<number>();
  readonly accreditationId = input.required<string>();
}
