import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { Account, Activity, ActivityType, Contact, CrmEntityType, Note } from '../models/crm.models';
import { SAMPLE_ACCOUNTS, SAMPLE_ACTIVITIES, SAMPLE_CONTACTS, SAMPLE_NOTES } from './crm-sample-data';

interface ApiPaged<T> { items: T[]; total: number; page: number; pageSize: number; }

export interface ActivityInput {
  type: ActivityType;
  subject: string;
  dueAt: string;
  relatedToType: CrmEntityType;
  relatedToId: string;
  owner: string;
  reminderAt?: string | null;
}

// Lighter shared store for the secondary CRM screens (Contacts, Accounts, Activities, Notes).
@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm`;

  private readonly _accounts = signal<Account[]>([]);
  private readonly _contacts = signal<Contact[]>([]);
  private readonly _activities = signal<Activity[]>([]);
  private readonly _notes = signal<Note[]>([]);

  readonly accounts = this._accounts.asReadonly();
  readonly contacts = this._contacts.asReadonly();
  readonly activities = this._activities.asReadonly();
  readonly notes = this._notes.asReadonly();

  loadAccounts(): void {
    this.http.get<ApiPaged<Account>>(`${this.base}/accounts?page=1&pageSize=200`).pipe(
      catchError(() => of<ApiPaged<Account>>({ items: [...SAMPLE_ACCOUNTS], total: SAMPLE_ACCOUNTS.length, page: 1, pageSize: 200 }))
    ).subscribe((r) => this._accounts.set(r.items.length ? r.items : [...SAMPLE_ACCOUNTS]));
  }

  loadContacts(): void {
    this.http.get<ApiPaged<Contact>>(`${this.base}/contacts?page=1&pageSize=200`).pipe(
      catchError(() => of<ApiPaged<Contact>>({ items: [...SAMPLE_CONTACTS], total: SAMPLE_CONTACTS.length, page: 1, pageSize: 200 }))
    ).subscribe((r) => this._contacts.set(r.items.length ? r.items : [...SAMPLE_CONTACTS]));
  }

  loadActivities(): void {
    this.http.get<ApiPaged<Activity>>(`${this.base}/activities?page=1&pageSize=200`).pipe(
      catchError(() => of<ApiPaged<Activity>>({ items: [...SAMPLE_ACTIVITIES], total: SAMPLE_ACTIVITIES.length, page: 1, pageSize: 200 }))
    ).subscribe((r) => this._activities.set(r.items.length ? r.items : [...SAMPLE_ACTIVITIES]));
  }

  loadNotes(): void {
    if (this._notes().length === 0) this._notes.set([...SAMPLE_NOTES]);
  }

  contactsForAccount(accountId: string): Contact[] {
    return this._contacts().filter((c) => c.accountId === accountId);
  }

  activitiesForRelated(type: CrmEntityType, id: string): Activity[] {
    return this._activities().filter((a) => a.relatedToType === type && a.relatedToId === id);
  }

  notesForRelated(type: CrmEntityType, id: string): Note[] {
    return this._notes().filter((n) => n.relatedToType === type && n.relatedToId === id);
  }

  createActivity(input: ActivityInput): Observable<Activity> {
    return this.http.post<Activity>(`${this.base}/activities`, input).pipe(
      catchError(() => of(this.fabricateActivity(input))),
      tap((a) => this._activities.update((list) => [a, ...list]))
    );
  }

  markActivityDone(id: string): Observable<Activity | null> {
    return this.http.post<Activity>(`${this.base}/activities/${id}/done`, {}).pipe(
      catchError(() => of(this.localDone(id))),
      tap((a) => { if (a) this._activities.update((list) => list.map((x) => (x.id === id ? a : x))); })
    );
  }

  createNote(body: string, relatedToType: CrmEntityType, relatedToId: string, author: string): Observable<Note> {
    const payload = { body, relatedToType, relatedToId, author };
    return this.http.post<Note>(`${this.base}/notes`, payload).pipe(
      catchError(() => of<Note>({ id: crypto.randomUUID(), body, relatedToType, relatedToId, author, createdAt: new Date().toISOString() })),
      tap((n) => this._notes.update((list) => [n, ...list]))
    );
  }

  private fabricateActivity(input: ActivityInput): Activity {
    return {
      id: crypto.randomUUID(),
      type: input.type,
      subject: input.subject,
      dueAt: input.dueAt,
      status: 'open',
      relatedToType: input.relatedToType,
      relatedToId: input.relatedToId,
      owner: input.owner,
      reminderAt: input.reminderAt ?? null,
      createdAt: new Date().toISOString()
    };
  }

  private localDone(id: string): Activity | null {
    const a = this._activities().find((x) => x.id === id);
    return a ? { ...a, status: 'done', completedAt: new Date().toISOString() } : null;
  }
}
