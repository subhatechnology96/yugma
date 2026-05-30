import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '@env/environment';

export type ProvisioningStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface ProvisioningRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  email: string;
  department: string;
  designation: string;
  location: string;
  status: ProvisioningStatus;
  requestedAt: string;
  completedAt?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
}

export interface UpdateStatusBody {
  status: ProvisioningStatus;
  assignedTo?: string | null;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProvisioningService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/provisioning`;

  private readonly _items = signal<ProvisioningRequest[]>([]);
  readonly items = this._items.asReadonly();

  readonly pendingCount = computed(() => this._items().filter((r) => r.status === 'pending').length);
  readonly inProgressCount = computed(() => this._items().filter((r) => r.status === 'in_progress').length);
  readonly completedCount = computed(() => this._items().filter((r) => r.status === 'completed').length);

  refresh(status?: ProvisioningStatus | null) {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    this.http.get<ProvisioningRequest[]>(this.base, { params }).subscribe((rows) => this._items.set(rows));
  }

  updateStatus(id: string, body: UpdateStatusBody) {
    return this.http.put<ProvisioningRequest>(`${this.base}/${id}/status`, body).pipe(
      tap((updated) =>
        this._items.update((list) => list.map((r) => (r.id === id ? updated : r)))
      )
    );
  }
}
