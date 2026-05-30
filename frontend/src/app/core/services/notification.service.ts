import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

export type NotificationKind = 'info' | 'success' | 'warn' | 'danger';
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdAt: string;
  read: boolean;
  link?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notifications`;
  private readonly _items = signal<AppNotification[]>([]);
  readonly items = this._items.asReadonly();
  readonly unreadCount = computed(() => this._items().filter((n) => !n.read).length);

  constructor() {
    this.refresh();
  }

  refresh() {
    this.http.get<AppNotification[]>(this.base).subscribe((rows) => this._items.set(rows));
  }

  markAllRead() {
    this.http.post(`${this.base}/read-all`, {}).subscribe(() =>
      this._items.update((list) => list.map((n) => ({ ...n, read: true })))
    );
  }

  markRead(id: string) {
    this.http.post(`${this.base}/${id}/read`, {}).subscribe(() =>
      this._items.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
    );
  }
}
