import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { environment } from '@env/environment';

interface Row {
  employeeId: string; name: string; designation: string; department: string; avatarUrl?: string;
  currentRating: number; prevRating: number; delta: number; trend: number[]; latestLabel: string; status: string; onPip: boolean; nineBox: string;
}

@Component({
  selector: 'app-hr-appraisals',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TableModule, PageHeaderComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Human Resources" title="Appraisals" subtitle="Performance appraisals across the team — ratings, trends and review status." />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[24px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="card overflow-hidden">
      <p-table [value]="rows()" responsiveLayout="scroll" [rowHover]="true" [paginator]="rows().length > 15" [rows]="15" class="p-1">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase !text-surface-500">Employee</th>
            <th class="!text-xs !uppercase !text-surface-500">Department</th>
            <th class="!text-xs !uppercase !text-surface-500">Rating</th>
            <th class="!text-xs !uppercase !text-surface-500">Trend</th>
            <th class="!text-xs !uppercase !text-surface-500">9-box</th>
            <th class="!text-xs !uppercase !text-surface-500">Status</th>
            <th class="!w-24"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-r>
          <tr>
            <td>
              <div class="flex items-center gap-2">
                <app-avatar [name]="r.name" [image]="r.avatarUrl" size="xs" />
                <div class="min-w-0"><div class="text-sm font-medium truncate">{{ r.name }}</div><div class="text-[11px] text-surface-400 truncate">{{ r.designation }}</div></div>
              </div>
            </td>
            <td class="text-sm text-surface-500">{{ r.department }}</td>
            <td>
              <div class="flex items-center gap-1.5">
                <div class="flex items-center gap-0.5 text-amber-400">
                  @for (s of [1,2,3,4,5]; track s) { <i class="pi text-[11px]" [class.pi-star-fill]="s <= round(r.currentRating)" [class.pi-star]="s > round(r.currentRating)" [class.text-surface-300]="s > round(r.currentRating)"></i> }
                </div>
                <span class="text-xs text-surface-500 tabular-nums">{{ r.currentRating | number: '1.1-1' }}</span>
              </div>
            </td>
            <td>
              <span class="text-xs tabular-nums" [class]="r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-rose-500' : 'text-surface-400'">
                <i class="pi text-[9px]" [class.pi-arrow-up]="r.delta > 0" [class.pi-arrow-down]="r.delta < 0" [class.pi-minus]="r.delta === 0"></i>
                {{ r.delta > 0 ? '+' : '' }}{{ r.delta | number: '1.1-1' }}
              </span>
            </td>
            <td><span class="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 dark:bg-surface-800">{{ r.nineBox }}</span></td>
            <td>
              @if (r.onPip) { <span class="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">On PIP</span> }
              @else { <span class="text-[11px] px-2 py-0.5 rounded-full" [class]="statusTone(r.status)">{{ r.status }}</span> }
            </td>
            <td class="text-right">
              <a [routerLink]="['/my-work/employees', r.employeeId]" class="text-xs text-brand-600 hover:underline">Review</a>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="7" class="py-10 text-center text-surface-500">No appraisal data.</td></tr></ng-template>
      </p-table>
    </div>
  `
})
export class AppraisalsComponent {
  private readonly http = inject(HttpClient);
  protected readonly rows = signal<Row[]>([]);

  constructor() {
    this.http.get<Row[]>(`${environment.apiBaseUrl}/my-work/performance/tracker`).subscribe((r) => this.rows.set(r));
  }

  protected readonly stats = computed(() => {
    const r = this.rows();
    const avg = r.length ? r.reduce((a, x) => a + x.currentRating, 0) / r.length : 0;
    return [
      { label: 'Employees', value: r.length, caption: 'in review cycle', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Avg rating', value: avg.toFixed(1), caption: 'out of 5', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Top performers', value: r.filter((x) => x.currentRating >= 4).length, caption: '4★ and above', tone: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'On PIP', value: r.filter((x) => x.onPip).length, caption: 'needs support', tone: (r.filter((x) => x.onPip).length) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100' }
    ];
  });

  round(n: number): number { return Math.round(n); }
  statusTone(s: string): string {
    const k = (s || '').toLowerCase();
    if (k.includes('exceed') || k.includes('strong') || k.includes('top')) return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300';
    if (k.includes('meet') || k.includes('on track')) return 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300';
    if (k.includes('below') || k.includes('risk')) return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300';
    return 'bg-surface-100 text-surface-500 dark:bg-surface-800';
  }
}
