import { Injectable, computed, signal } from '@angular/core';

export interface Tenant {
  id: string;
  name: string;
  shortName: string;
  plan: 'starter' | 'growth' | 'enterprise';
  primaryColor?: string;
}

const TENANT_KEY = 'crm.tenant';
const DEFAULT_TENANTS: Tenant[] = [
  { id: 't_yugma', name: 'Yugma', shortName: 'Y', plan: 'enterprise' },
  { id: 't_globex', name: 'Globex Industries', shortName: 'GI', plan: 'growth' },
  { id: 't_initech', name: 'Initech Labs', shortName: 'IL', plan: 'starter' }
];

@Injectable({ providedIn: 'root' })
export class TenantService {
  readonly tenants = signal<Tenant[]>(DEFAULT_TENANTS);

  private readonly _current = signal<Tenant>(this.restore());
  readonly current = this._current.asReadonly();
  readonly currentId = computed(() => this._current().id);

  switch(id: string) {
    const next = this.tenants().find((t) => t.id === id);
    if (next) {
      this._current.set(next);
      localStorage.setItem(TENANT_KEY, id);
    }
  }

  private restore(): Tenant {
    const id = localStorage.getItem(TENANT_KEY);
    return DEFAULT_TENANTS.find((t) => t.id === id) ?? DEFAULT_TENANTS[0];
  }
}
