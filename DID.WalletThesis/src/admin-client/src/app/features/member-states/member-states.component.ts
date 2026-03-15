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
import { AccreditationService } from '../../core/services/accreditation.service';
import { Accreditation } from '../../core/models/accreditation.model';
import {
  EU_ROOT_LABEL,
  NavigationStateService,
} from '../../core/services/navigation-state.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TxBadgeComponent } from '../../shared/components/tx-badge/tx-badge.component';
import {
  AccreditationChainNode,
  AccreditationDetailPanelComponent,
} from '../../shared/components/accreditation-detail-panel/accreditation-detail-panel.component';

@Component({
  selector: 'app-member-states',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, BreadcrumbComponent, EmptyStateComponent, TxBadgeComponent, AccreditationDetailPanelComponent],
  templateUrl: './member-states.component.html',
})
export class MemberStatesComponent implements OnInit {
  private readonly accreditationService = inject(AccreditationService);
  private readonly navState = inject(NavigationStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly euRootLabel = EU_ROOT_LABEL;

  readonly memberStates = signal<Accreditation[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly lastIssued = signal<Accreditation | null>(null);
  readonly selected = signal<Accreditation | null>(null);
  readonly verification = signal<import('../../core/models/accreditation.model').AccreditationVerification | null>(null);
  readonly verifying = signal(false);
  readonly revoking = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    ethereumAddress: ['', [Validators.required, Validators.pattern(/^0x[0-9a-fA-F]{40}$/)]],
  });

  ngOnInit(): void {
    this.navState.resetToRoot();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.accreditationService.list(this.navState.euRootDid, undefined, 'MemberState').subscribe({
      next: (data) => {
        this.memberStates.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load member states');
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
    this.submitting.set(true);
    const { name, ethereumAddress } = this.form.getRawValue();
    const subjectDID = `did:ethr:sepolia:${ethereumAddress}`;

    this.accreditationService
      .issue({
        issuerDID: this.navState.euRootDid,
        subjectDID,
        scope: 'MemberState',
        name: name!,
        parentAccreditationId: null,
      })
      .subscribe({
        next: (result) => {
          this.lastIssued.set(result);
          this.submitting.set(false);
          this.form.reset();
          this.load();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? err?.message ?? 'Failed to issue accreditation');
          this.submitting.set(false);
        },
      });
  }

  selectMemberState(ms: Accreditation): void {
    this.navState.selectMemberState({
      did: ms.subjectDID,
      label: ms.name || ms.scope,
      accreditationId: ms.accreditationId,
    });
    this.router.navigate(['/ministries']);
  }

  inspect(ms: Accreditation): void {
    this.selected.set(ms);
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
    this.accreditationService.revoke(selected.accreditationId, selected.issuerDID).subscribe({
      next: () => {
        this.revoking.set(false);
        this.load();
        this.verifySelected();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? err?.message ?? 'Failed to revoke accreditation');
        this.revoking.set(false);
      },
    });
  }

  trustChainForSelected(): AccreditationChainNode[] {
    const selected = this.selected();
    if (!selected) return [];
    return [
      { label: this.euRootLabel, did: this.navState.euRootDid, emphasis: 'root' },
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
