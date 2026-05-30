import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { Deal, DealStage, Pipeline } from '../models/crm.models';
import { SAMPLE_DEALS, SAMPLE_STAGES } from './crm-sample-data';

export interface DealInput {
  name: string;
  accountId: string;
  contactId?: string | null;
  value: number;
  stageId: string;
  closeDate: string;
  owner: string;
}

@Injectable({ providedIn: 'root' })
export class DealService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm/deals`;

  private readonly _stages = signal<DealStage[]>([]);
  private readonly _deals = signal<Deal[]>([]);
  readonly stages = this._stages.asReadonly();
  readonly deals = this._deals.asReadonly();
  readonly loading = signal(false);

  load(): void {
    this.loading.set(true);
    this.http.get<Pipeline>(`${this.base}/pipeline`).pipe(
      catchError(() => of(this.samplePipeline()))
    ).subscribe((p) => {
      const stages = p.stages
        .map((s) => ({ id: s.stageId, name: s.name, order: s.order, probability: s.probability, isWon: s.isWon, isLost: s.isLost }))
        .sort((a, b) => a.order - b.order);
      this._stages.set(stages.length ? stages : [...SAMPLE_STAGES]);
      this._deals.set(p.stages.flatMap((s) => s.deals));
      this.loading.set(false);
    });
  }

  dealsForStage(stageId: string): Deal[] {
    return this._deals().filter((d) => d.stageId === stageId);
  }

  // Optimistically reflect the drop, then persist; failure leaves the optimistic state in place offline.
  moveStage(dealId: string, stageId: string): void {
    const stage = this._stages().find((s) => s.id === stageId);
    this._deals.update((list) =>
      list.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stageId,
              stageName: stage?.name ?? d.stageName,
              probability: stage?.probability ?? d.probability,
              status: stage?.isWon ? 'won' : stage?.isLost ? 'lost' : 'open'
            }
          : d
      )
    );
    this.http.post(`${this.base}/${dealId}/stage`, { stageId }).pipe(catchError(() => of(null))).subscribe();
  }

  create(input: DealInput): Observable<Deal> {
    return this.http.post<Deal>(this.base, input).pipe(
      catchError(() => of(this.fabricate(input))),
      tap((deal) => this._deals.update((list) => [deal, ...list]))
    );
  }

  private fabricate(input: DealInput): Deal {
    const stage = this._stages().find((s) => s.id === input.stageId);
    return {
      id: crypto.randomUUID(),
      code: `DEAL-${1000 + this._deals().length + 1}`,
      name: input.name,
      accountId: input.accountId,
      accountName: '—',
      contactId: input.contactId ?? null,
      value: input.value,
      stageId: input.stageId,
      stageName: stage?.name ?? '—',
      status: stage?.isWon ? 'won' : stage?.isLost ? 'lost' : 'open',
      probability: stage?.probability ?? 0,
      closeDate: input.closeDate,
      owner: input.owner,
      createdAt: new Date().toISOString()
    };
  }

  private samplePipeline(): Pipeline {
    const stages = SAMPLE_STAGES.map((s) => {
      const deals = SAMPLE_DEALS.filter((d) => d.stageId === s.id);
      return {
        stageId: s.id,
        name: s.name,
        order: s.order,
        probability: s.probability,
        isWon: s.isWon,
        isLost: s.isLost,
        totalValue: deals.reduce((sum, d) => sum + d.value, 0),
        count: deals.length,
        deals
      };
    });
    const open = stages.filter((s) => !s.isWon && !s.isLost);
    return {
      stages,
      totalOpenValue: open.reduce((sum, s) => sum + s.totalValue, 0),
      weightedValue: open.reduce((sum, s) => sum + (s.totalValue * s.probability) / 100, 0)
    };
  }
}
