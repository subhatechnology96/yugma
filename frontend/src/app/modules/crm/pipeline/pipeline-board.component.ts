import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { DealService } from '../services/deal.service';
import { Deal, DealStage } from '../models/crm.models';

@Component({
  selector: 'app-pipeline-board',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    ButtonModule,
    TableModule,
    PageHeaderComponent,
    StatusPillComponent,
    AvatarComponent,
    InrPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM · Sales" title="Pipeline" subtitle="Drag deals across stages to update them. {{ deals().length }} active deals worth {{ totalValue() | inr: 'compact' }}.">
      <div class="flex items-center rounded-lg border border-surface-200 dark:border-surface-800 p-0.5">
        <button type="button" (click)="view.set('board')" class="px-3 py-1.5 text-sm rounded-md font-medium transition"
          [class.bg-brand-600]="view() === 'board'" [class.text-white]="view() === 'board'"
          [class.text-surface-600]="view() !== 'board'">
          <i class="pi pi-th-large text-xs mr-1"></i> Board
        </button>
        <button type="button" (click)="view.set('list')" class="px-3 py-1.5 text-sm rounded-md font-medium transition"
          [class.bg-brand-600]="view() === 'list'" [class.text-white]="view() === 'list'"
          [class.text-surface-600]="view() !== 'list'">
          <i class="pi pi-list text-xs mr-1"></i> List
        </button>
      </div>
      <button pButton icon="pi pi-plus" label="New deal"></button>
    </app-page-header>

    @if (view() === 'board') {
      <div class="flex gap-3 overflow-x-auto pb-2" cdkDropListGroup>
        @for (col of columns(); track col.stage.id) {
          <div class="flex flex-col w-72 shrink-0">
            <div class="flex items-center justify-between mb-2 px-1">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" [style.background]="dotColor(col.stage)"></span>
                <span class="text-sm font-semibold">{{ col.stage.name }}</span>
                <span class="pill-neutral">{{ col.deals.length }}</span>
              </div>
              <span class="text-xs font-semibold text-surface-500 tabular-nums">{{ stageTotal(col.deals) | inr: 'compact' }}</span>
            </div>
            <div
              class="rounded-2xl p-2 space-y-2 min-h-[320px] bg-surface-50 dark:bg-surface-900/40 border border-surface-200/70 dark:border-surface-800 transition"
              cdkDropList
              [cdkDropListData]="col.deals"
              (cdkDropListDropped)="drop($event, col.stage)"
            >
              @for (deal of col.deals; track deal.id) {
                <div class="bg-white dark:bg-surface-900 rounded-xl p-3 border border-surface-200 dark:border-surface-800 shadow-soft hover:shadow-card transition cursor-grab active:cursor-grabbing"
                  cdkDrag [cdkDragData]="deal">
                  <div class="flex items-start justify-between gap-2">
                    <div class="text-sm font-semibold leading-snug min-w-0">{{ deal.name }}</div>
                    <span class="text-xs font-semibold text-brand-600 tabular-nums shrink-0">{{ deal.value | inr: 'compact' }}</span>
                  </div>
                  <div class="text-xs text-surface-500 mt-1 truncate">{{ deal.accountName }}</div>
                  <div class="flex items-center justify-between mt-3">
                    <div class="flex items-center gap-1.5 text-[11px] text-surface-500">
                      <i class="pi pi-calendar text-[10px]"></i>
                      {{ deal.closeDate | date: 'MMM d' }}
                    </div>
                    <app-avatar [name]="deal.owner" size="xs" />
                  </div>
                </div>
              }
              @if (col.deals.length === 0) {
                <div class="text-center text-xs text-surface-400 py-8">Drop deals here</div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="card">
        <p-table [value]="deals()" [paginator]="true" [rows]="10" responsiveLayout="scroll" [rowHover]="true">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!text-xs !uppercase" pSortableColumn="name">Deal</th>
              <th class="!text-xs !uppercase">Account</th>
              <th class="!text-xs !uppercase">Stage</th>
              <th class="!text-xs !uppercase" pSortableColumn="value">Value</th>
              <th class="!text-xs !uppercase">Close date</th>
              <th class="!text-xs !uppercase">Owner</th>
              <th class="!text-xs !uppercase">Status</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-d>
            <tr>
              <td class="font-medium">{{ d.name }}</td>
              <td>{{ d.accountName }}</td>
              <td>{{ d.stageName }}</td>
              <td class="tabular-nums font-semibold">{{ d.value | inr: 'compact' }}</td>
              <td>{{ d.closeDate | date: 'mediumDate' }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <app-avatar [name]="d.owner" size="xs" />
                  <span class="text-sm">{{ d.owner }}</span>
                </div>
              </td>
              <td><app-status-pill [tone]="statusTone(d.status)">{{ d.status | titlecase }}</app-status-pill></td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }
  `
})
export class PipelineBoardComponent {
  private readonly dealSvc = inject(DealService);

  readonly view = signal<'board' | 'list'>('board');
  readonly deals = this.dealSvc.deals;

  readonly columns = computed(() =>
    this.dealSvc.stages().map((stage) => ({
      stage,
      deals: this.dealSvc.deals().filter((d) => d.stageId === stage.id)
    }))
  );

  readonly totalValue = computed(() =>
    this.dealSvc.deals().filter((d) => d.status === 'open').reduce((sum, d) => sum + d.value, 0)
  );

  constructor() {
    this.dealSvc.load();
  }

  drop(event: CdkDragDrop<Deal[]>, targetStage: DealStage): void {
    if (event.previousContainer === event.container) return;
    const deal = event.item.data as Deal;
    this.dealSvc.moveStage(deal.id, targetStage.id);
  }

  stageTotal(deals: Deal[]): number {
    return deals.reduce((sum, d) => sum + d.value, 0);
  }

  dotColor(stage: DealStage): string {
    if (stage.isWon) return '#10b981';
    if (stage.isLost) return '#ef4444';
    return ['#94b1ff', '#6987ff', '#4361ff', '#2f44e6'][Math.min(stage.order - 1, 3)] ?? '#4361ff';
  }

  statusTone(status: string): 'success' | 'warn' | 'danger' | 'neutral' {
    return status === 'won' ? 'success' : status === 'lost' ? 'danger' : 'neutral';
  }
}
