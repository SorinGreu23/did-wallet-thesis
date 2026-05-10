import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  EnterpriseRegistration,
  EnterpriseRegistrationService,
} from '../../core/services/enterprise-registration.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccreditationService } from '../../core/services/accreditation.service';
import { extractApiError } from '../../core/utils/api-error';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { switchMap } from 'rxjs';

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected';

@Component({
  selector: 'app-enterprises',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, BreadcrumbComponent, EmptyStateComponent],
  templateUrl: './enterprises.component.html',
})
export class EnterprisesComponent implements OnInit {
  private readonly enterpriseService = inject(EnterpriseRegistrationService);
  private readonly accreditationService = inject(AccreditationService);
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly registrations = signal<EnterpriseRegistration[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('All');

  // Approve flow — stores the full registration being approved
  readonly approvingRegistration = signal<EnterpriseRegistration | null>(null);
  readonly approvingId = computed(() => this.approvingRegistration()?.requestId ?? null);
  readonly submittingApprove = signal(false);

  // Reject flow
  readonly rejectingId = signal<string | null>(null);
  readonly submittingReject = signal(false);
  readonly rejectForm = this.fb.group({
    reason: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly filtered = computed(() => {
    const filter = this.statusFilter();
    const all = this.registrations();
    if (filter === 'All') return all;
    return all.filter((r) => r.status === filter);
  });

  readonly pendingCount = computed(
    () => this.registrations().filter((r) => r.status === 'Pending').length,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    this.enterpriseService.list().subscribe({
      next: (data) => {
        this.registrations.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err, 'Failed to load enterprise registrations'));
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  // ── Approve ──────────────────────────────────────────────────────────────

  openApprove(reg: EnterpriseRegistration): void {
    this.approvingRegistration.set(reg);
    this.rejectingId.set(null);
    this.successMessage.set(null);
    this.error.set(null);
  }

  closeApprove(): void {
    this.approvingRegistration.set(null);
  }

  submitApprove(): void {
    const reg = this.approvingRegistration();
    if (!reg) return;
    const session = this.auth.session();
    if (!session) return;

    this.submittingApprove.set(true);
    this.error.set(null);

    this.accreditationService
      .issueViaClientWallet(
        session.did,
        reg.walletAddress,
        'Enterprise',
        reg.legalName,
        session.accreditationId,
      )
      .pipe(
        switchMap((accreditation) =>
          this.enterpriseService.approve(reg.requestId, accreditation.accreditationId),
        ),
      )
      .subscribe({
        next: (result) => {
          this.submittingApprove.set(false);
          this.approvingRegistration.set(null);
          this.successMessage.set(`Approved: ${result.legalName}. Accreditation issued on-chain.`);
          this.load();
        },
        error: (err) => {
          this.error.set(extractApiError(err, 'Failed to approve registration'));
          this.submittingApprove.set(false);
        },
      });
  }

  // ── Reject ───────────────────────────────────────────────────────────────

  openReject(requestId: string): void {
    this.rejectingId.set(requestId);
    this.approvingRegistration.set(null);
    this.rejectForm.reset();
    this.successMessage.set(null);
    this.error.set(null);
  }

  closeReject(): void {
    this.rejectingId.set(null);
    this.rejectForm.reset();
  }

  submitReject(): void {
    const requestId = this.rejectingId();
    if (!requestId || this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    const { reason } = this.rejectForm.getRawValue();
    this.submittingReject.set(true);
    this.enterpriseService.reject(requestId, reason!).subscribe({
      next: (result) => {
        this.submittingReject.set(false);
        this.rejectingId.set(null);
        this.rejectForm.reset();
        this.successMessage.set(`Rejected: ${result.legalName}.`);
        this.load();
      },
      error: (err) => {
        this.error.set(extractApiError(err, 'Failed to reject registration'));
        this.submittingReject.set(false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusClass(status: string): string {
    switch (status) {
      case 'Pending':  return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      default:         return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  shortAddress(address: string): string {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
  }

  readonly statusFilters: StatusFilter[] = ['All', 'Pending', 'Approved', 'Rejected'];
}
