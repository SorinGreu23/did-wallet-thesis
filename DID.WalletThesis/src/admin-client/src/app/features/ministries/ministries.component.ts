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
import { AccreditationService } from '../../core/services/accreditation.service';
import { Accreditation } from '../../core/models/accreditation.model';
import { NavigationStateService } from '../../core/services/navigation-state.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TxBadgeComponent } from '../../shared/components/tx-badge/tx-badge.component';

@Component({
  selector: 'app-ministries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, BreadcrumbComponent, EmptyStateComponent, TxBadgeComponent],
  templateUrl: './ministries.component.html',
})
export class MinistriesComponent implements OnInit {
  private readonly accreditationService = inject(AccreditationService);
  readonly navState = inject(NavigationStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly ministries = signal<Accreditation[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly lastIssued = signal<Accreditation | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    ethereumAddress: ['', [Validators.required, Validators.pattern(/^0x[0-9a-fA-F]{40}$/)]],
  });

  ngOnInit(): void {
    const ms = this.navState.memberState();
    if (!ms) {
      this.router.navigate(['/member-states']);
      return;
    }
    this.load();
  }

  load(): void {
    const ms = this.navState.memberState();
    if (!ms) return;
    this.loading.set(true);
    this.error.set(null);
    this.accreditationService.list(this.navState.euRootDid, undefined, 'Ministry').subscribe({
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
    const subjectDID = `did:ethr:sepolia:${ethereumAddress}`;

    this.accreditationService
      .issue({
        issuerDID: this.navState.euRootDid,
        subjectDID,
        scope: 'Ministry',
        name: name!,
        parentAccreditationId: ms.accreditationId,
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

  drillInto(ministry: Accreditation): void {
    this.navState.selectMinistry({
      did: ministry.subjectDID,
      label: ministry.name || ministry.scope,
      accreditationId: ministry.accreditationId,
    });
    this.router.navigate(['/universities']);
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
