import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TooltipModule } from 'primeng/tooltip';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { HrAccessService } from '@core/services/hr-access.service';
import { environment } from '@env/environment';

interface Competency { name: string; score: number; }
interface PerfQuarter {
  quarter: number; label: string; rating: number; goalProgress: number; status: string; reviewer: string;
  nineBox: string; oneOnOnes: number; competencies: Competency[]; summary: string; isManual: boolean;
}
interface PerfYear { year: number; avg: number; reviews: number; quarters: PerfQuarter[]; }
interface PerfEmployee {
  employeeId: string; name: string; designation: string; department: string; avatarUrl?: string;
  manager: string; currentRating: number; delta: number; nineBox: string; years: PerfYear[];
}

/**
 * "My Work · My Performance" — the signed-in user's own performance: current rating, 9-box, quarter-on-quarter
 * trend and the calibrated quarterly reviews their manager has recorded. Read-only (reviews are entered by the
 * manager under My Team · Performance); reuses GET /api/hr/performance/employee/{selfId}.
 */
@Component({
  selector: 'app-my-performance',
  standalone: true,
  imports: [
    DecimalPipe, TooltipModule,
    PageHeaderComponent, KpiCardComponent, StatusPillComponent, AvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Work · Growth" title="My Performance" subtitle="Your calibrated ratings, 9-box and quarter-on-quarter trend." />

    @if (loaded() && !emp()) {
      <div class="card py-16 grid place-items-center text-center">
        <div class="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 grid place-items-center mb-4">
          <i class="pi pi-chart-line text-2xl text-surface-400"></i>
        </div>
        <div class="font-semibold text-lg">No performance record yet</div>
        <div class="text-sm text-surface-500 mt-1">Your performance profile will appear once your manager runs a review.</div>
      </div>
    } @else if (emp(); as e) {
      <!-- Identity + headline rating -->
      <div class="card p-5 mb-4 flex items-center gap-4">
        <app-avatar [name]="e.name" [image]="e.avatarUrl" size="lg" />
        <div class="min-w-0">
          <div class="font-semibold text-lg truncate">{{ e.name }}</div>
          <div class="text-xs text-surface-500">{{ e.designation }} · {{ e.department }} · Reviewer: {{ e.manager }}</div>
          <div class="text-[11px] text-surface-500 mt-0.5">{{ e.nineBox }}</div>
        </div>
        <div class="ml-auto text-right">
          <div class="flex items-center gap-1 justify-end">
            <span class="text-3xl font-semibold text-amber-500">{{ e.currentRating | number: '1.1-1' }}</span>
            <span class="text-xs" [class.text-emerald-600]="e.delta > 0" [class.text-rose-600]="e.delta < 0" [class.text-surface-400]="e.delta === 0">
              <i class="pi text-[10px]" [class.pi-arrow-up-right]="e.delta > 0" [class.pi-arrow-down-right]="e.delta < 0" [class.pi-minus]="e.delta === 0"></i>
              {{ e.delta > 0 ? '+' : '' }}{{ e.delta | number: '1.1-1' }}
            </span>
          </div>
          <div class="text-[11px] text-surface-500">current rating</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <app-kpi-card label="Current rating" [value]="e.currentRating" format="1.1-1" caption="out of 5" icon="pi-star" tone="amber" />
        <app-kpi-card label="This year avg" [value]="selectedYearData()?.avg ?? 0" format="1.2-2" caption="{{ selectedYear() }}" icon="pi-chart-line" tone="brand" />
        <app-kpi-card label="Reviews" [value]="selectedYearData()?.reviews ?? 0" caption="recorded {{ selectedYear() }}" icon="pi-check-circle" tone="emerald" />
        <app-kpi-card label="Quarter trend" [value]="trendDelta()" format="1.1-1" caption="vs previous quarter" icon="pi-arrows-v" tone="indigo" />
      </div>

      <!-- Year selector -->
      <div class="flex flex-wrap gap-2 mb-4">
        @for (y of e.years; track y.year) {
          <button type="button" (click)="selectedYear.set(y.year)"
            class="rounded-lg border px-3 py-2 text-left transition-colors"
            [class]="selectedYear() === y.year ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900/40'">
            <div class="text-[11px] text-surface-500">{{ y.year }}</div>
            <div class="text-sm font-semibold tabular-nums">{{ y.avg | number: '1.2-2' }} <span class="text-[10px] text-surface-400">avg · {{ y.reviews }} reviews</span></div>
          </button>
        }
      </div>

      <!-- Quarter cards (read-only) -->
      @if (selectedYearData(); as yd) {
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          @for (q of yd.quarters; track q.quarter) {
            <div class="card p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-semibold">
                  {{ q.label }}
                  @if (q.isManual) { <i class="pi pi-pencil text-[10px] text-brand-500 ml-1" pTooltip="Manually reviewed by your manager"></i> }
                </span>
                <app-status-pill [tone]="q.status === 'In review' ? 'warn' : q.status === 'Pending' ? 'neutral' : 'success'">{{ q.status }}</app-status-pill>
              </div>
              <div class="flex items-center gap-2 mb-2">
                <div class="flex items-center gap-0.5 text-amber-500">
                  @for (s of [1,2,3,4,5]; track s) {
                    <i class="pi text-xs" [class.pi-star-fill]="s <= round(q.rating)" [class.pi-star]="s > round(q.rating)" [class.text-surface-300]="s > round(q.rating)"></i>
                  }
                </div>
                <span class="text-sm font-medium tabular-nums">{{ q.rating | number: '1.1-1' }}</span>
              </div>
              <div class="text-[11px] text-surface-500 mb-1">Goal / OKR progress · {{ q.goalProgress }}%</div>
              <div class="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden mb-2">
                <div class="h-full rounded-full bg-emerald-500" [style.width.%]="q.goalProgress"></div>
              </div>
              <div class="space-y-1 mb-2">
                @for (c of q.competencies; track c.name) {
                  <div class="flex items-center gap-2 text-[11px]">
                    <span class="w-24 text-surface-500 shrink-0">{{ c.name }}</span>
                    <div class="flex-1 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                      <div class="h-full rounded-full bg-brand-500" [style.width.%]="(c.score / 5) * 100"></div>
                    </div>
                    <span class="tabular-nums">{{ c.score }}</span>
                  </div>
                }
              </div>
              @if (q.summary) { <p class="text-[11px] text-surface-500 italic">“{{ q.summary }}”</p> }
              <div class="text-[10px] text-surface-400 mt-1">{{ q.oneOnOnes }} 1:1s · {{ q.nineBox }}</div>
            </div>
          }
        </div>
      }
    } @else {
      <div class="card py-16 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
    }
  `
})
export class MyPerformanceComponent {
  private readonly http = inject(HttpClient);
  private readonly hrAccess = inject(HrAccessService);
  private readonly base = `${environment.apiBaseUrl}/my-work/performance`;

  protected readonly emp = signal<PerfEmployee | null>(null);
  protected readonly loaded = signal(false);
  protected readonly selectedYear = signal<number>(new Date().getFullYear());
  protected readonly selectedYearData = computed(() => this.emp()?.years.find((y) => y.year === this.selectedYear()) ?? null);

  /** Delta of the latest quarter vs the one before it (within the selected year, falling back across years). */
  protected readonly trendDelta = computed(() => {
    const all = (this.emp()?.years ?? []).flatMap((y) => y.quarters).filter((q) => q.status !== 'Pending');
    if (all.length < 2) return 0;
    return Math.round((all[all.length - 1].rating - all[all.length - 2].rating) * 10) / 10;
  });

  constructor() {
    this.hrAccess.ensure().subscribe((acc) => {
      const id = acc?.employeeId;
      if (!id) {
        this.loaded.set(true);
        return;
      }
      this.http.get<PerfEmployee>(`${this.base}/employee/${id}`).subscribe({
        next: (d) => {
          this.emp.set(d);
          this.selectedYear.set(d.years[0]?.year ?? new Date().getFullYear());
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true)
      });
    });
  }

  round(n: number): number { return Math.round(n); }
}
