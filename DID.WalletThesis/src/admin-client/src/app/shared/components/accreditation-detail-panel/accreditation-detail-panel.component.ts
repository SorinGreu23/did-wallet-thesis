import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Accreditation, AccreditationVerification } from '../../../core/models/accreditation.model';

export interface AccreditationChainNode {
  label: string;
  did: string;
  emphasis?: 'root' | 'selected' | 'intermediate';
}

@Component({
  selector: 'app-accreditation-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (accreditation(); as item) {
      <section class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">Accreditation Detail</h2>
            <p class="text-xs text-gray-500 mt-1">Inspect on-chain references, trust chain, and verification result.</p>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close details"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-6">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div class="space-y-4">
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</p>
                <p class="mt-1 text-lg font-semibold text-gray-900">{{ item.name || item.scope }}</p>
              </div>

              <dl class="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scope</dt>
                  <dd class="mt-1 text-sm text-gray-800">{{ item.scope }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</dt>
                  <dd class="mt-1">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border {{ statusClass(item.status) }}">
                      {{ item.status }}
                    </span>
                  </dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Issuer DID</dt>
                  <dd class="mt-1 font-mono text-xs text-gray-700 break-all">{{ item.issuerDID }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject DID</dt>
                  <dd class="mt-1 font-mono text-xs text-gray-700 break-all">{{ item.subjectDID }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Block</dt>
                  <dd class="mt-1 font-mono text-xs text-gray-700">{{ item.blockNumber }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Issued</dt>
                  <dd class="mt-1 text-sm text-gray-700">{{ item.issuedAt | date : 'dd MMM yyyy, HH:mm' }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Accreditation ID</dt>
                  <dd class="mt-1 font-mono text-xs text-gray-700 break-all">{{ item.accreditationId }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Hash</dt>
                  <dd class="mt-1 font-mono text-xs text-gray-700 break-all">{{ item.transactionHash }}</dd>
                </div>
                @if (item.parentAccreditationId) {
                  <div class="sm:col-span-2">
                    <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent Accreditation</dt>
                    <dd class="mt-1 font-mono text-xs text-gray-700 break-all">{{ item.parentAccreditationId }}</dd>
                  </div>
                }
              </dl>
            </div>

            <div class="space-y-4">
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trust Chain</p>
                <div class="mt-3 space-y-2">
                  @for (node of trustChain(); track node.did; let last = $last) {
                    <div class="flex items-start gap-3">
                      <div class="flex flex-col items-center shrink-0 pt-0.5">
                        <span class="w-3 h-3 rounded-full"
                          [class.bg-[#003399]]="node.emphasis === 'root'"
                          [class.bg-gray-400]="node.emphasis === 'intermediate'"
                          [class.bg-green-600]="node.emphasis === 'selected'"
                        ></span>
                        @if (!last) {
                          <span class="w-px h-8 bg-gray-200 mt-1"></span>
                        }
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900">{{ node.label }}</p>
                        <p class="font-mono text-[11px] text-gray-500 break-all">{{ node.did }}</p>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Verification</p>
                    @if (verification(); as result) {
                      <p class="mt-1 text-sm font-semibold" [class.text-green-700]="result.isValid" [class.text-red-700]="!result.isValid">
                        {{ result.status }}
                      </p>
                      @if (result.reason) {
                        <p class="mt-1 text-xs text-gray-600">{{ result.reason }}</p>
                      }
                    } @else {
                      <p class="mt-1 text-sm text-gray-500">No verification run yet.</p>
                    }
                  </div>
                  <button
                    type="button"
                    (click)="verify.emit()"
                    [disabled]="verifying()"
                    class="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#003399] border border-[#003399]/30 rounded-lg hover:bg-[#003399] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    @if (verifying()) {
                      <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Verifying…
                    } @else {
                      Verify On-Chain
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              (click)="close.emit()"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              (click)="revoke.emit()"
              [disabled]="revoking() || item.status.toLowerCase() !== 'active'"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              @if (revoking()) {
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Revoking…
              } @else {
                Revoke Accreditation
              }
            </button>
          </div>
        </div>
      </section>
    }
  `,
  imports: [DatePipe],
})
export class AccreditationDetailPanelComponent {
  readonly accreditation = input.required<Accreditation | null>();
  readonly trustChain = input.required<AccreditationChainNode[]>();
  readonly verification = input<AccreditationVerification | null>(null);
  readonly verifying = input(false);
  readonly revoking = input(false);

  readonly verify = output<void>();
  readonly revoke = output<void>();
  readonly close = output<void>();

  statusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'revoked':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }
}