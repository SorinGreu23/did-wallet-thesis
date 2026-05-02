import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AccreditationService } from '../../core/services/accreditation.service';
import { Accreditation } from '../../core/models/accreditation.model';
import { NavigationStateService } from '../../core/services/navigation-state.service';
import { AuthService } from '../../core/auth/auth.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TxBadgeComponent } from '../../shared/components/tx-badge/tx-badge.component';
import {
  AccreditationChainNode,
  AccreditationDetailPanelComponent,
} from '../../shared/components/accreditation-detail-panel/accreditation-detail-panel.component';
import { AccreditationVerification } from '../../core/models/accreditation.model';

@Component({
  selector: 'app-ministries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, BreadcrumbComponent, EmptyStateComponent, TxBadgeComponent, AccreditationDetailPanelComponent],
  templateUrl: './ministries.component.html',
})
export class MinistriesComponent implements OnInit {
  private readonly accreditationService = inject(AccreditationService);
  private readonly auth = inject(AuthService);
  readonly navState = inject(NavigationStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

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

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const hasContext = await this.ensureMemberStateContext();
    this.contextLoading.set(false);

    if (hasContext) {
      this.load();
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
          err?.error?.message ?? err?.message ?? 'Failed to resolve member state context',
        );
        return false;
      }
    }

    return currentMemberState !== null;
  }

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
        this.error.set(err?.message ?? 'Failed to load ministries');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'Failed to issue accreditation');
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
        this.error.set(err?.error?.message ?? err?.message ?? 'Failed to verify accreditation');
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
        this.error.set(err?.error?.message ?? err?.message ?? 'Failed to revoke accreditation');
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
