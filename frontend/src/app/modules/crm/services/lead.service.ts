import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { ConvertLeadResult, Lead, LeadStatus } from '../models/crm.models';
import { SAMPLE_LEADS } from './crm-sample-data';

export interface LeadInput {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  score: number;
  owner: string;
}

interface ApiPaged<T> { items: T[]; total: number; page: number; pageSize: number; }

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm/leads`;

  private readonly _all = signal<Lead[]>([]);
  readonly all = this._all.asReadonly();
  readonly loading = signal(false);

  load(): void {
    this.loading.set(true);
    this.http.get<ApiPaged<Lead>>(`${this.base}?page=1&pageSize=200`).pipe(
      map((r) => r.items),
      catchError(() => of<Lead[]>([...SAMPLE_LEADS]))
    ).subscribe((items) => {
      this._all.set(items.length ? items : [...SAMPLE_LEADS]);
      this.loading.set(false);
    });
  }

  create(input: LeadInput): Observable<Lead> {
    return this.http.post<Lead>(this.base, input).pipe(
      catchError(() => of(this.fabricate(input))),
      tap((lead) => this._all.update((list) => [lead, ...list]))
    );
  }

  update(id: string, input: LeadInput): Observable<Lead> {
    return this.http.put<Lead>(`${this.base}/${id}`, input).pipe(
      catchError(() => of(this.merge(id, input))),
      tap((lead) => this._all.update((list) => list.map((l) => (l.id === id ? lead : l))))
    );
  }

  changeStatus(id: string, status: LeadStatus): Observable<Lead> {
    return this.http.post<Lead>(`${this.base}/${id}/status`, { status }).pipe(
      catchError(() => of(this.patch(id, { status }))),
      tap((lead) => this._all.update((list) => list.map((l) => (l.id === id ? lead : l))))
    );
  }

  convert(id: string, body: { dealName?: string; dealValue: number; closeDate?: string | null; stageId?: string | null }): Observable<ConvertLeadResult> {
    return this.http.post<ConvertLeadResult>(`${this.base}/${id}/convert`, body).pipe(
      catchError(() => of<ConvertLeadResult>({ leadId: id, accountId: crypto.randomUUID(), contactId: crypto.randomUUID(), dealId: crypto.randomUUID(), dealCode: 'DEAL-NEW' })),
      tap(() => this._all.update((list) => list.map((l) => (l.id === id ? { ...l, status: 'converted' as LeadStatus } : l))))
    );
  }

  private fabricate(input: LeadInput): Lead {
    return {
      id: crypto.randomUUID(),
      code: `LEAD-${1000 + this._all().length + 1}`,
      fullName: input.fullName,
      company: input.company,
      email: input.email,
      phone: input.phone,
      source: input.source,
      status: 'new',
      score: input.score,
      owner: input.owner,
      createdAt: new Date().toISOString()
    };
  }

  private merge(id: string, input: LeadInput): Lead {
    const existing = this._all().find((l) => l.id === id)!;
    return { ...existing, ...input, updatedAt: new Date().toISOString() };
  }

  private patch(id: string, patch: Partial<Lead>): Lead {
    const existing = this._all().find((l) => l.id === id)!;
    return { ...existing, ...patch, updatedAt: new Date().toISOString() };
  }
}
