import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AccreditationService } from '../../core/services/accreditation.service';
import { Accreditation, AccreditationVerification } from '../../core/models/accreditation.model';
import { NavigationStateService } from '../../core/services/navigation-state.service';
import { AuthService } from '../../core/auth/auth.service';
import { extractApiError } from '../../core/utils/api-error';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TxBadgeComponent } from '../../shared/components/tx-badge/tx-badge.component';
import {
  AccreditationChainNode,
  AccreditationDetailPanelComponent,
} from '../../shared/components/accreditation-detail-panel/accreditation-detail-panel.component';

@Component({
  selector: 'app-government',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, BreadcrumbComponent, EmptyStateComponent, TxBadgeComponent, AccreditationDetailPanelComponent],
  templateUrl: './government.component.html',
})
export class GovernmentComponent implements OnInit {
  private readonly accreditationService = inject(AccreditationService);
  readonly auth = inject(AuthService);
  readonly navState = inject(NavigationStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // ── Ministries ────────────────────────────────────────────────────────────
  readonly ministries = signal<Accreditation[]>([]);
  readonly contextLoading = signal(true);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly lastIssued = signal<Accreditation | null>(null);
  readonly selected = signal<Accreditation | null>(null);
  readonly verification = signal<AccreditationVerification | null>(null);
  readonly verifying = signal(false);
  readonly revoking = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    ethereumAddress: ['', [Validators.required, Validators.pattern(/^0x[0-9a-fA-F]{40}$/)]],
  });

  // ── Business Registry ────────────────────────────────────────────────────
  readonly businessRegistries = signal<Accreditation[]>([]);
  readonly brLoading = signal(false);
  readonly brError = signal<string | null>(null);
  readonly showBrForm = signal(false);
  readonly brSubmitting = signal(false);
  readonly brLastIssued = signal<Accreditation | null>(null);
  readonly brSelected = signal<Accreditation | null>(null);
  readonly brVerification = signal<AccreditationVerification | null>(null);
  readonly brVerifying = signal(false);
  readonly brRevoking = signal(false);

  readonly brForm = this.fb.group({
    name: [''],
    ethereumAddress: ['', [Validators.required, Validators.pattern(/^0x[0-9a-fA-F]{40}$/)]],
  });

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const hasContext = await this.ensureMemberStateContext();
    this.contextLoading.set(false);

    if (hasContext) {
      this.load();
      this.loadBR();
    }
  }

  private async ensureMemberStateContext(): Promise<boolean> {
    const session = this.auth.session();
    const currentMemberState = this.navState.memberState();

    if (session?.scope === 'MemberState' && session.accreditationId) {
      if (currentMemberState?.accreditationId === session.accreditationId) {
        return true;
      }

      try {
        this.navState.resetToRoot();
        const memberState = await firstValueFrom(
          this.accreditationService.get(session.accreditationId),
        );

        this.navState.selectMemberState({
          did: memberState.subjectDID,
          label: memberState.name || memberState.scope,
          accreditationId: memberState.accreditationId,
        });

        return true;
      } catch (err: any) {
        this.error.set(
          extractApiError(err, 'Failed to resolve member state context'),
        );
        return false;
      }
    }

    return currentMemberState !== null;
  }

  // ── Ministry methods ──────────────────────────────────────────────────────

  load(): void {
    const ms = this.navState.memberState();
    if (!ms) return;
    this.loading.set(true);
    this.error.set(null);
    this.accreditationService.list(ms.did, undefined, 'Ministry').subscribe({
      next: (data) => {
        this.ministries.set(data.filter(m => m.parentAccreditationId === ms.accreditationId));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err, 'Failed to load ministries'));
        this.loading.set(false);
      },
    });
  }

  openForm(): void {
    this.showForm.set(true);
    this.lastIssued.set(null);
    this.form.reset();
  }

  closeForm(): void {
    this.showForm.set(false);
    this.form.reset();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const ms = this.navState.memberState();
    if (!ms) return;
    this.submitting.set(true);
    const { name, ethereumAddress } = this.form.getRawValue();

    this.accreditationService
      .issueViaClientWallet(
        ms.did,
        ethereumAddress!,
        'Ministry',
        name!,
        ms.accreditationId,
      )
      .subscribe({
        next: (result) => {
          this.lastIssued.set(result);
          this.submitting.set(false);
          this.form.reset();
          this.load();
        },
        error: (err) => {
          if (err?.message === 'SIGNER_LOST') {
            this.auth.logout();
            return;
          }
          this.error.set(extractApiError(err, 'Failed to issue accreditation'));
          this.submitting.set(false);
        },
      });
  }

  selectMinistry(ministry: Accreditation): void {
    this.navState.selectMinistry({
      did: ministry.subjectDID,
      label: ministry.name || ministry.scope,
      accreditationId: ministry.accreditationId,
    });
    this.router.navigate(['/universities']);
  }

  inspect(ministry: Accreditation): void {
    this.selected.set(ministry);
    this.verification.set(null);
  }

  closeDetails(): void {
    this.selected.set(null);
    this.verification.set(null);
  }

  verifySelected(): void {
    const selected = this.selected();
    if (!selected) return;
    this.verifying.set(true);
    this.accreditationService.verify(selected.accreditationId).subscribe({
      next: (result) => {
        this.verification.set(result);
        this.verifying.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err, 'Failed to verify accreditation'));
        this.verifying.set(false);
      },
    });
  }

  revokeSelected(): void {
    const selected = this.selected();
    if (!selected) return;
    this.revoking.set(true);
    this.accreditationService.revokeViaClientWallet(selected.accreditationId, selected.issuerDID).subscribe({
      next: () => {
        this.revoking.set(false);
        this.load();
        this.verifySelected();
      },
      error: (err) => {
        if (err?.message === 'SIGNER_LOST') {
          this.auth.logout();
          return;
        }
        this.error.set(extractApiError(err, 'Failed to revoke accreditation'));
        this.revoking.set(false);
      },
    });
  }

  trustChainForSelected(): AccreditationChainNode[] {
    const selected = this.selected();
    const ms = this.navState.memberState();
    if (!selected || !ms) return [];
    return [
      { label: 'EU Root Authority', did: this.navState.euRootDid, emphasis: 'root' },
      { label: ms.label, did: ms.did, emphasis: 'intermediate' },
      { label: selected.name || selected.scope, did: selected.subjectDID, emphasis: 'selected' },
    ];
  }

  // ── Business Registry methods ─────────────────────────────────────────────

  loadBR(): void {
    const ms = this.navState.memberState();
    if (!ms) return;
    this.brLoading.set(true);
    this.brError.set(null);
    this.accreditationService.list(ms.did, undefined, 'BusinessRegistry').subscribe({
      next: (data) => {
        this.businessRegistries.set(data.filter(a => a.parentAccreditationId === ms.accreditationId));
        this.brLoading.set(false);
      },
      error: (err) => {
        this.brError.set(extractApiError(err, 'Failed to load business registries'));
        this.brLoading.set(false);
      },
    });
  }

  openBrForm(): void {
    this.showBrForm.set(true);
    this.brLastIssued.set(null);
    this.brForm.reset();
  }

  closeBrForm(): void {
    this.showBrForm.set(false);
    this.brForm.reset();
  }

  submitBR(): void {
    if (this.brForm.invalid) {
      this.brForm.markAllAsTouched();
      return;
    }
    const ms = this.navState.memberState();
    if (!ms) return;
    this.brSubmitting.set(true);
    const { name, ethereumAddress } = this.brForm.getRawValue();

    this.accreditationService
      .issueViaClientWallet(
        ms.did,
        ethereumAddress!,
        'BusinessRegistry',
        name || null,
        ms.accreditationId,
      )
      .subscribe({
        next: (result) => {
          this.brLastIssued.set(result);
          this.brSubmitting.set(false);
          this.brForm.reset();
          this.loadBR();
        },
        error: (err) => {
          if (err?.message === 'SIGNER_LOST') {
            this.auth.logout();
            return;
          }
          this.brError.set(extractApiError(err, 'Failed to issue BusinessRegistry accreditation'));
          this.brSubmitting.set(false);
        },
      });
  }

  inspectBR(br: Accreditation): void {
    this.brSelected.set(br);
    this.brVerification.set(null);
  }

  closeBRDetails(): void {
    this.brSelected.set(null);
    this.brVerification.set(null);
  }

  verifyBRSelected(): void {
    const selected = this.brSelected();
    if (!selected) return;
    this.brVerifying.set(true);
    this.accreditationService.verify(selected.accreditationId).subscribe({
      next: (result) => {
        this.brVerification.set(result);
        this.brVerifying.set(false);
      },
      error: (err) => {
        this.brError.set(extractApiError(err, 'Failed to verify accreditation'));
        this.brVerifying.set(false);
      },
    });
  }

  revokeBRSelected(): void {
    const selected = this.brSelected();
    if (!selected) return;
    this.brRevoking.set(true);
    this.accreditationService.revokeViaClientWallet(selected.accreditationId, selected.issuerDID).subscribe({
      next: () => {
        this.brRevoking.set(false);
        this.loadBR();
        this.verifyBRSelected();
      },
      error: (err) => {
        if (err?.message === 'SIGNER_LOST') {
          this.auth.logout();
          return;
        }
        this.brError.set(extractApiError(err, 'Failed to revoke accreditation'));
        this.brRevoking.set(false);
      },
    });
  }

  trustChainForBRSelected(): AccreditationChainNode[] {
    const selected = this.brSelected();
    const ms = this.navState.memberState();
    if (!selected || !ms) return [];
    return [
      { label: 'EU Root Authority', did: this.navState.euRootDid, emphasis: 'root' },
      { label: ms.label, did: ms.did, emphasis: 'intermediate' },
      { label: selected.name || selected.scope, did: selected.subjectDID, emphasis: 'selected' },
    ];
  }

  statusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'revoked': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  shortHash(hash: string): string {
    if (!hash || hash.length < 12) return hash;
    return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  }
}
