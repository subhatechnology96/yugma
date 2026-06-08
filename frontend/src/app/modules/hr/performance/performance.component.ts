import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { StatusPillComponent, StatusTone } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ThemeService } from '@core/services/theme.service';
import { AuthService } from '@core/services/auth.service';
import { HrAccessService } from '@core/services/hr-access.service';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { environment } from '@env/environment';

interface QuarterAvg { quarter: number; label: string; avg: number; status: string; }
interface PerfSummary {
  year: number; avgRating: number; topPerformers: number; onPip: number; reviewsDue: number; employees: number;
  distribution: number[]; byQuarter: QuarterAvg[];
}
interface TrackerRow {
  employeeId: string; name: string; designation: string; department: string; avatarUrl?: string;
  currentRating: number; prevRating: number; delta: number; trend: number[]; latestLabel: string; status: string; onPip: boolean; nineBox: string;
}
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

@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, TableModule, ButtonModule, ChartModule, TabsModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, TextareaModule, TooltipModule,
    PageHeaderComponent, KpiCardComponent, StatusPillComponent, AvatarComponent, HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="My Team · Growth" title="Team Performance" subtitle="Track your team — calibrated ratings, 9-box, quarter-on-quarter trends. Add and change quarterly reviews.">
      @if (canReview()) {
        <button pButton icon="pi pi-plus" label="Add quarterly review" (click)="startReview()"></button>
      }
    </app-page-header>

    <app-hr-agent-rail [keys]="['active.performance', 'active.learning', 'confirmation.feedback']" title="Performance co-pilots" />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <app-kpi-card label="Avg. rating" [value]="summary().avgRating" format="1.2-2" caption="out of 5" icon="pi-star" tone="amber" />
      <app-kpi-card label="Top performers" [value]="summary().topPerformers" caption="rated 4.5+" icon="pi-bolt" tone="emerald" />
      <app-kpi-card label="On PIP" [value]="summary().onPip" caption="performance improvement plan" icon="pi-exclamation-triangle" tone="rose" />
      <app-kpi-card label="Reviews due" [value]="summary().reviewsDue" caption="this cycle" icon="pi-clock" tone="brand" />
    </div>

    <div class="card">
      <p-tabs value="tracker">
        <p-tablist>
          <p-tab value="tracker">Employee tracker</p-tab>
          <p-tab value="overview">Calibration overview</p-tab>
        </p-tablist>
        <p-tabpanels>
          <!-- ===================== TRACKER ===================== -->
          <p-tabpanel value="tracker">
            <div class="p-2 space-y-3">
              <span class="relative block max-w-sm">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                <input pInputText [(ngModel)]="search" (input)="onSearch()" placeholder="Search employee, role, department…" class="w-full !pl-10 !rounded-lg" />
              </span>

              <p-table [value]="tracker()" responsiveLayout="scroll" [rowHover]="true" [paginator]="tracker().length > 12" [rows]="12">
                <ng-template pTemplate="header">
                  <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                    <th class="!text-xs !uppercase !text-surface-500">Employee</th>
                    <th class="!text-xs !uppercase !text-surface-500">Department</th>
                    <th class="!text-xs !uppercase !text-surface-500">Current rating</th>
                    <th class="!text-xs !uppercase !text-surface-500">Trend (4 qtrs)</th>
                    <th class="!text-xs !uppercase !text-surface-500">9-box</th>
                    <th class="!text-xs !uppercase !text-surface-500">Status</th>
                    <th class="!w-10"></th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-r>
                  <tr class="cursor-pointer" (click)="openEmployee(r.employeeId)">
                    <td>
                      <div class="flex items-center gap-3">
                        <app-avatar [name]="r.name" [image]="r.avatarUrl" size="sm" />
                        <div class="min-w-0"><div class="font-medium truncate">{{ r.name }}</div><div class="text-[11px] text-surface-500 truncate">{{ r.designation }}</div></div>
                      </div>
                    </td>
                    <td class="text-sm">{{ r.department }}</td>
                    <td>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-0.5 text-amber-500">
                          @for (s of [1,2,3,4,5]; track s) {
                            <i class="pi text-xs" [class.pi-star-fill]="s <= round(r.currentRating)" [class.pi-star]="s > round(r.currentRating)" [class.text-surface-300]="s > round(r.currentRating)"></i>
                          }
                        </div>
                        <span class="text-sm font-medium tabular-nums">{{ r.currentRating | number: '1.1-1' }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-end gap-0.5 h-8">
                        @for (t of r.trend; track $index) {
                          <div class="w-2 rounded-sm bg-brand-400" [style.height.%]="(t / 5) * 100" pTooltip="{{ t | number: '1.1-1' }}"></div>
                        }
                        <span class="ml-1.5 text-xs self-center" [class.text-emerald-600]="r.delta > 0" [class.text-rose-600]="r.delta < 0" [class.text-surface-400]="r.delta === 0">
                          <i class="pi text-[10px]" [class.pi-arrow-up-right]="r.delta > 0" [class.pi-arrow-down-right]="r.delta < 0" [class.pi-minus]="r.delta === 0"></i>
                          {{ r.delta > 0 ? '+' : '' }}{{ r.delta | number: '1.1-1' }}
                        </span>
                      </div>
                    </td>
                    <td class="text-xs text-surface-500">{{ r.nineBox }}</td>
                    <td>
                      @if (r.onPip) { <app-status-pill tone="danger">On PIP</app-status-pill> }
                      @else { <app-status-pill [tone]="r.status === 'In review' ? 'warn' : 'success'">{{ r.status }}</app-status-pill> }
                    </td>
                    <td><i class="pi pi-chevron-right text-xs text-surface-400"></i></td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabpanel>

          <!-- ===================== OVERVIEW ===================== -->
          <p-tabpanel value="overview">
            <div class="p-2 grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div class="xl:col-span-2 space-y-4">
                <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-5">
                  <div class="section-title">Calibrated rating distribution</div>
                  <div class="text-lg font-semibold mt-1 mb-4">This cycle · {{ summary().employees }} employees</div>
                  <div class="h-[240px]"><p-chart type="bar" [data]="dist()" [options]="opts()" /></div>
                </div>

                <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-5">
                  <div class="flex items-center justify-between mb-3">
                    <div class="section-title">Average rating by quarter</div>
                    <p-select [options]="yearOptions" [(ngModel)]="year" (onChange)="loadSummary()" styleClass="!rounded-lg" />
                  </div>
                  <div class="flex items-end gap-4 h-40">
                    @for (q of summary().byQuarter; track q.quarter) {
                      <div class="flex-1 flex flex-col items-center justify-end h-full gap-1" [pTooltip]="q.label + ' · ' + (q.avg ? q.avg : '—')">
                        <span class="text-xs font-medium tabular-nums">{{ q.avg ? (q.avg | number: '1.1-1') : '' }}</span>
                        <div class="w-full rounded-t" [class]="q.status === 'in review' ? 'bg-amber-400' : q.status === 'calibrated' ? 'bg-brand-500' : 'bg-surface-200 dark:bg-surface-700'" [style.height.%]="(q.avg / 5) * 100"></div>
                        <span class="text-[11px] text-surface-400">{{ q.label }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-5">
                <div class="section-title mb-3">Highest rated</div>
                <ul class="space-y-3">
                  @for (e of tracker().slice(0, 6); track e.employeeId) {
                    <li class="flex items-center gap-3 cursor-pointer" (click)="openEmployee(e.employeeId)">
                      <app-avatar [name]="e.name" [image]="e.avatarUrl" size="sm" />
                      <div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">{{ e.name }}</div><div class="text-xs text-surface-500 truncate">{{ e.designation }}</div></div>
                      <span class="text-sm font-semibold tabular-nums text-amber-500">{{ e.currentRating | number: '1.1-1' }}</span>
                    </li>
                  }
                </ul>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <!-- ===================== Employee performance dialog ===================== -->
    <p-dialog [(visible)]="empVisible" [modal]="true" [style]="{ width: '44rem' }" [header]="(emp()?.name || '') + ' · Performance'" [draggable]="false" [dismissableMask]="true">
      @if (emp(); as e) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center gap-3">
            <app-avatar [name]="e.name" [image]="e.avatarUrl" size="lg" />
            <div>
              <div class="font-semibold">{{ e.name }}</div>
              <div class="text-xs text-surface-500">{{ e.designation }} · {{ e.department }} · Reviewer: {{ e.manager }}</div>
              <div class="text-[11px] text-surface-500 mt-0.5">{{ e.nineBox }}</div>
            </div>
            <div class="ml-auto text-right">
              <div class="flex items-center gap-1 justify-end">
                <span class="text-2xl font-semibold text-amber-500">{{ e.currentRating | number: '1.1-1' }}</span>
                <span class="text-xs" [class.text-emerald-600]="e.delta > 0" [class.text-rose-600]="e.delta < 0" [class.text-surface-400]="e.delta === 0">
                  {{ e.delta > 0 ? '+' : '' }}{{ e.delta | number: '1.1-1' }}
                </span>
              </div>
              <div class="text-[11px] text-surface-500">current rating</div>
            </div>
          </div>

          <!-- year-wise averages -->
          <div class="flex flex-wrap gap-2">
            @for (y of e.years; track y.year) {
              <button type="button" (click)="selectedYear.set(y.year)"
                class="rounded-lg border px-3 py-2 text-left transition-colors"
                [class]="selectedYear() === y.year ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900/40'">
                <div class="text-[11px] text-surface-500">{{ y.year }}</div>
                <div class="text-sm font-semibold tabular-nums">{{ y.avg | number: '1.2-2' }} <span class="text-[10px] text-surface-400">avg · {{ y.reviews }} reviews</span></div>
              </button>
            }
          </div>

          <!-- quarter-wise detail for selected year -->
          @if (selectedYearData(); as yd) {
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (q of yd.quarters; track q.quarter) {
                <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-semibold">
                      {{ q.label }}
                      @if (q.isManual) { <i class="pi pi-pencil text-[10px] text-brand-500 ml-1" pTooltip="Manually reviewed"></i> }
                    </span>
                    <div class="flex items-center gap-1.5">
                      <app-status-pill [tone]="q.status === 'In review' ? 'warn' : q.status === 'Pending' ? 'neutral' : 'success'">{{ q.status }}</app-status-pill>
                      @if (canReview()) {
                        <button pButton text rounded size="small" icon="pi pi-pencil" pTooltip="Review / edit" class="!text-surface-500 !w-7 !h-7" (click)="openReview(q); $event.stopPropagation()"></button>
                      }
                    </div>
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
                  <p class="text-[11px] text-surface-500 italic">“{{ q.summary }}”</p>
                  <div class="text-[10px] text-surface-400 mt-1">{{ q.oneOnOnes }} 1:1s · {{ q.nineBox }}</div>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="p-10 grid place-items-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>
      }
      <ng-template pTemplate="footer"><button pButton label="Close" (click)="empVisible = false"></button></ng-template>
    </p-dialog>

    <!-- ===================== Add quarterly review (pick member + period) ===================== -->
    <p-dialog [(visible)]="newReviewVisible" [modal]="true" [style]="{ width: '30rem' }" header="Add quarterly review" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <p class="text-sm text-surface-600 dark:text-surface-300">Pick a team member and the quarter to review, then enter the rating and feedback.</p>
        <div>
          <label class="text-xs font-medium text-surface-600">Team member</label>
          <p-select [options]="employeeOptions()" [(ngModel)]="newReview.employeeId" placeholder="Select a team member" [filter]="true" filterBy="label" styleClass="w-full mt-1 !rounded-lg" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-surface-600">Year</label>
            <p-select [options]="yearOptions" [(ngModel)]="newReview.year" styleClass="w-full mt-1 !rounded-lg" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Quarter</label>
            <p-select [options]="quarterOptions" [(ngModel)]="newReview.quarter" styleClass="w-full mt-1 !rounded-lg" />
          </div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="newReviewVisible = false"></button>
        <button pButton label="Continue" icon="pi pi-arrow-right" iconPos="right" [disabled]="!newReview.employeeId" (click)="beginReview()"></button>
      </ng-template>
    </p-dialog>

    <!-- ===================== Review editor (Admin / HR / manager) ===================== -->
    <p-dialog [(visible)]="reviewVisible" [modal]="true" [style]="{ width: '32rem' }" [header]="'Review · ' + reviewForm.label" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-4 pt-1">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-surface-600">Overall rating (1–5)</label>
            <p-inputNumber [(ngModel)]="reviewForm.rating" [min]="1" [max]="5" [minFractionDigits]="1" [maxFractionDigits]="1" [step]="0.1" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Goal / OKR progress (%)</label>
            <p-inputNumber [(ngModel)]="reviewForm.goalProgress" [min]="0" [max]="100" suffix=" %" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Status</label>
            <p-select [options]="reviewStatusOptions" [(ngModel)]="reviewForm.status" styleClass="w-full mt-1 !rounded-lg" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Reviewer</label>
            <input pInputText [(ngModel)]="reviewForm.reviewer" class="w-full mt-1 !rounded-lg" />
          </div>
        </div>

        <div>
          <label class="text-xs font-medium text-surface-600 mb-1 block">Competencies (1–5)</label>
          <div class="space-y-2">
            @for (name of competencyNames; track name; let i = $index) {
              <div class="flex items-center gap-3">
                <span class="w-28 text-sm text-surface-500 shrink-0">{{ name }}</span>
                <p-inputNumber [(ngModel)]="reviewForm.competencies[i]" [min]="1" [max]="5" [showButtons]="true" buttonLayout="horizontal" styleClass="flex-1" inputStyleClass="!rounded-lg w-12 text-center" />
              </div>
            }
          </div>
        </div>

        <div>
          <label class="text-xs font-medium text-surface-600">Reviewer summary</label>
          <textarea pTextarea [(ngModel)]="reviewForm.summary" rows="3" class="w-full mt-1 !rounded-lg" placeholder="Calibration notes, feedback, next-quarter goals…"></textarea>
        </div>
        <p class="text-[11px] text-surface-500"><i class="pi pi-info-circle mr-1"></i>Saving overrides the system-calibrated values for this quarter.</p>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="danger" text label="Reset to system" icon="pi pi-undo" (click)="resetReview()"></button>
        <button pButton severity="secondary" outlined label="Cancel" (click)="reviewVisible = false"></button>
        <button pButton label="Save review" icon="pi pi-check" (click)="saveReview()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class PerformanceComponent {
  private readonly http = inject(HttpClient);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/my-work/performance`;

  /** Only Admin / HR / Manager may review and change ratings. */
  private readonly hrAccess = inject(HrAccessService);
  // HR/admins review anyone; team leads review their reports (the data they see is already scoped to their team).
  protected readonly canReview = computed(() => this.hrAccess.canManageTeam());

  protected year = new Date().getFullYear();
  protected readonly yearOptions = [this.year - 2, this.year - 1, this.year].map((y) => ({ label: String(y), value: y }));
  protected search = '';

  protected readonly summary = signal<PerfSummary>({ year: this.year, avgRating: 0, topPerformers: 0, onPip: 0, reviewsDue: 0, employees: 0, distribution: [0, 0, 0, 0, 0], byQuarter: [] });
  protected readonly tracker = signal<TrackerRow[]>([]);

  empVisible = false;
  protected readonly emp = signal<PerfEmployee | null>(null);
  protected readonly selectedYear = signal<number>(this.year);
  protected readonly selectedYearData = computed(() => this.emp()?.years.find((y) => y.year === this.selectedYear()) ?? null);

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.loadSummary();
    this.loadTracker();
  }

  loadSummary() {
    this.http.get<PerfSummary>(`${this.base}/summary`, { params: { year: String(this.year), scope: 'team' } }).subscribe((d) => this.summary.set(d));
  }
  loadTracker() {
    const params: Record<string, string> = { scope: 'team' };
    if (this.search.trim()) params['search'] = this.search.trim();
    this.http.get<TrackerRow[]>(`${this.base}/tracker`, { params }).subscribe((d) => this.tracker.set(d));
  }
  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadTracker(), 300);
  }

  openEmployee(id: string) {
    this.emp.set(null);
    this.empVisible = true;
    this.http.get<PerfEmployee>(`${this.base}/employee/${id}`).subscribe((d) => {
      this.emp.set(d);
      this.selectedYear.set(d.years[0]?.year ?? this.year);
    });
  }

  // ---- add quarterly review (member + period picker) ----
  protected readonly quarterOptions = [1, 2, 3, 4].map((q) => ({ label: `Q${q}`, value: q }));
  protected readonly employeeOptions = computed(() =>
    this.tracker().map((r) => ({ label: `${r.name} · ${r.designation}`, value: r.employeeId }))
  );
  newReviewVisible = false;
  newReview: { employeeId: string; year: number; quarter: number } = {
    employeeId: '',
    year: this.year,
    quarter: Math.floor(new Date().getMonth() / 3) + 1
  };

  startReview() {
    this.newReview = {
      employeeId: this.tracker()[0]?.employeeId ?? '',
      year: this.year,
      quarter: Math.floor(new Date().getMonth() / 3) + 1
    };
    this.newReviewVisible = true;
  }

  /** Load the chosen member, then open the review editor for the chosen quarter (prefilled if it exists). */
  beginReview() {
    const id = this.newReview.employeeId;
    if (!id) return;
    const { year, quarter } = this.newReview;
    this.http.get<PerfEmployee>(`${this.base}/employee/${id}`).subscribe((d) => {
      this.emp.set(d);
      this.selectedYear.set(year);
      this.newReviewVisible = false;
      const q = d.years.find((y) => y.year === year)?.quarters.find((x) => x.quarter === quarter);
      if (q) {
        this.openReview(q);
      } else {
        // Quarter not in the generated series (e.g. future) — start a blank review.
        this.reviewForm = {
          label: `Q${quarter} ${year}`, year, quarter, rating: 3, goalProgress: 70,
          status: 'Calibrated', reviewer: d.manager || '', summary: '', competencies: [3, 3, 3, 3, 3]
        };
        this.reviewVisible = true;
      }
    });
  }

  // ---- review editor ----
  protected readonly competencyNames = ['Delivery', 'Collaboration', 'Ownership', 'Innovation', 'Communication'];
  protected readonly reviewStatusOptions = ['Calibrated', 'In review', 'Pending'];
  reviewVisible = false;
  reviewForm: { label: string; year: number; quarter: number; rating: number; goalProgress: number; status: string; reviewer: string; summary: string; competencies: number[] } =
    { label: '', year: this.year, quarter: 1, rating: 3, goalProgress: 70, status: 'Calibrated', reviewer: '', summary: '', competencies: [3, 3, 3, 3, 3] };

  openReview(q: PerfQuarter) {
    const e = this.emp();
    this.reviewForm = {
      label: q.label,
      year: this.selectedYear(),
      quarter: q.quarter,
      rating: q.rating,
      goalProgress: q.goalProgress,
      status: q.status,
      reviewer: q.reviewer || e?.manager || '',
      summary: q.summary,
      competencies: this.competencyNames.map((n) => q.competencies.find((c) => c.name === n)?.score ?? 3)
    };
    this.reviewVisible = true;
  }

  saveReview() {
    const e = this.emp();
    if (!e) return;
    const f = this.reviewForm;
    const body = {
      year: f.year, quarter: f.quarter, rating: f.rating, goalProgress: f.goalProgress,
      status: f.status, reviewer: f.reviewer, summary: f.summary, competencies: f.competencies,
      editedBy: this.auth.user()?.fullName ?? 'Reviewer'
    };
    this.http.put(`${this.base}/employee/${e.employeeId}/review`, body).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Review saved', detail: `${e.name} · ${f.label}` });
        this.reviewVisible = false;
        this.afterReviewChange(e.employeeId);
      },
      error: () => this.messages.add({ severity: 'error', summary: 'Save failed', detail: 'Could not save the review.' })
    });
  }

  resetReview() {
    const e = this.emp();
    if (!e) return;
    const f = this.reviewForm;
    this.http.delete(`${this.base}/employee/${e.employeeId}/review`, { params: { year: String(f.year), quarter: String(f.quarter) } }).subscribe({
      next: () => {
        this.messages.add({ severity: 'info', summary: 'Reverted', detail: `${f.label} reset to calibrated value.` });
        this.reviewVisible = false;
        this.afterReviewChange(e.employeeId);
      }
    });
  }

  private afterReviewChange(employeeId: string) {
    this.openEmployee(employeeId); // re-fetch detail (keeps dialog open)
    this.loadSummary();
    this.loadTracker();
  }

  round(n: number): number { return Math.round(n); }

  dist = computed(() => ({
    labels: ['1', '2', '3', '4', '5'],
    datasets: [{ label: 'Employees', data: this.summary().distribution, backgroundColor: '#6366f1', borderRadius: 8, barThickness: 36 }]
  }));

  opts = computed(() => {
    const dark = this.theme.isDark();
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? '#1e293b' : '#e2e8f0';
    return {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: text }, grid: { color: 'transparent' } },
        y: { ticks: { color: text, stepSize: 1 }, grid: { color: grid }, beginAtZero: true }
      }
    };
  });
}
