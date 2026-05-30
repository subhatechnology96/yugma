import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '@env/environment';

export type SubPlan = 'starter' | 'growth' | 'enterprise';
export type SubStatus = 'active' | 'trialing' | 'paused' | 'cancelled';
export type BillingCycle = 'monthly' | 'annual';

export interface ModuleSubscription {
  id: string;
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  plan: SubPlan;
  status: SubStatus;
  monthlyPrice: number;
  billingCycle: BillingCycle;
  seats: number;
  seatsUsed: number;
  startedAt: string;
  renewsAt: string;
  features: string[];
}

export interface UpdateSubscriptionBody {
  plan: SubPlan;
  status: SubStatus;
  billingCycle: BillingCycle;
  monthlyPrice: number;
  seats: number;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/subscriptions`;

  private readonly _items = signal<ModuleSubscription[]>([]);
  readonly items = this._items.asReadonly();

  refresh() {
    this.http.get<ModuleSubscription[]>(this.base).subscribe((rows) => this._items.set(rows));
  }

  update(id: string, body: UpdateSubscriptionBody) {
    return this.http.put<ModuleSubscription>(`${this.base}/${id}`, body).pipe(
      tap((updated) =>
        this._items.update((list) => list.map((s) => (s.id === id ? updated : s)))
      )
    );
  }
}
