import { Injectable, signal, computed, inject } from '@angular/core';
import { ConfigService } from './config.service';

export interface HierarchyNode {
  did: string;
  label: string;
  accreditationId: string;
}

// Foundry Anvil Account #0 — deployer of EURootAuthority.sol
export const EU_ROOT_LABEL = 'EU Root Authority';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  private readonly config = inject(ConfigService);

  get euRootDid(): string { return this.config.euRootDid(); }
  readonly memberState = signal<HierarchyNode | null>(null);
  readonly ministry = signal<HierarchyNode | null>(null);

  readonly breadcrumbs = computed(() => {
    const crumbs: { label: string; route: string }[] = [
      { label: EU_ROOT_LABEL, route: '/member-states' },
    ];

    const ms = this.memberState();
    if (ms) {
      crumbs.push({ label: ms.label, route: '/ministries' });
    }

    const min = this.ministry();
    if (min) {
      crumbs.push({ label: min.label, route: '/universities' });
    }

    return crumbs;
  });

  selectMemberState(node: HierarchyNode): void {
    this.memberState.set(node);
    this.ministry.set(null);
  }

  selectMinistry(node: HierarchyNode): void {
    this.ministry.set(node);
  }

  resetToRoot(): void {
    this.memberState.set(null);
    this.ministry.set(null);
  }
}
