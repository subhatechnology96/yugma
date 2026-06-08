import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SalesService } from '../sales.service';
import { ACTIVITY_META, CrmSummary, Opportunity, SALES_STAGES, SalesActivity, SalesStage } from '../models';

const TEAM = ['Mitchell Admin', 'Marc Demo', 'Priya Sharma'];
type Board = Record<SalesStage, Opportunity[]>;

@Component({
  selector: 'app-crm-pipeline',
  standalone: true,
  imports: [
    DatePipe, FormsModule, DragDropModule,
    ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, TextareaModule, DatePickerModule, TooltipModule,
    PageHeaderComponent, InrPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Sales · CRM" title="Pipeline" subtitle="Your opportunities by stage — drag a card to advance it, click to open the full record, schedule follow-ups and turn it into a quotation.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search opportunities…" class="!h-9 !text-sm w-56" />
      <button pButton icon="pi pi-plus" label="New" (click)="openCreate()"></button>
    </app-page-header>

    <!-- KPI strip -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[22px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <!-- Kanban -->
    <div class="card p-2">
      <div class="flex gap-4 overflow-x-auto pb-1" cdkDropListGroup>
        @for (col of stages; track col.key) {
          <div class="min-w-[280px] flex-1 flex flex-col">
            <div class="px-1 mb-2">
              <div class="flex items-center justify-between">
                <span class="text-[13px] font-medium text-surface-700 dark:text-surface-200 flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" [class]="col.dot"></span>{{ col.label }}
                  <span class="text-xs text-surface-400 tabular-nums">{{ board()[col.key].length }}</span>
                </span>
                <span class="text-[11px] font-semibold text-surface-500 tabular-nums">{{ colSum(col.key) | inr: 'compact' }}</span>
              </div>
              <div class="h-1 rounded-full mt-1.5 overflow-hidden bg-surface-100 dark:bg-surface-800">
                <div class="h-full rounded-full" [class]="col.bar" [style.width.%]="colPct(col.key)"></div>
              </div>
            </div>
            <div class="rounded-xl p-1.5 space-y-2 flex-1 min-h-[360px] bg-surface-50/60 dark:bg-surface-900/30"
              cdkDropList [cdkDropListData]="board()[col.key]" (cdkDropListDropped)="drop($event, col.key)">
              @for (o of board()[col.key]; track o.id) {
                <div class="bg-white dark:bg-surface-900 rounded-lg p-3 border border-surface-200/80 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm transition cursor-pointer"
                  cdkDrag (click)="openDetail(o)">
                  <div class="text-[13px] font-medium text-surface-800 dark:text-surface-100 leading-snug">{{ o.name }}</div>
                  <div class="text-[13px] font-semibold text-surface-700 dark:text-surface-200 mt-1 tabular-nums">{{ o.expectedRevenue | inr }}</div>
                  <div class="text-[11px] text-surface-500 truncate mt-0.5">{{ o.customer }}</div>

                  @if (o.tags.length) {
                    <div class="flex flex-wrap gap-1 mt-2">
                      @for (t of o.tags; track t) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full" [class]="tagClass(t)">{{ t }}</span>
                      }
                    </div>
                  }

                  <div class="mt-2.5 pt-2 border-t border-surface-100 dark:border-surface-800/70 flex items-center justify-between">
                    <span class="flex items-center gap-0.5">
                      @for (star of [1,2,3]; track star) {
                        <i class="pi text-[11px]" [class]="star <= o.priority ? 'pi-star-fill text-amber-400' : 'pi-star text-surface-300 dark:text-surface-600'"></i>
                      }
                    </span>
                    <span class="flex items-center gap-2">
                      @if (nextActivity(o); as a) {
                        <i class="pi {{ activityMeta[a.kind]?.icon || 'pi-bell' }} text-[12px]"
                          [class]="overdueAct(a) ? 'text-rose-500' : 'text-emerald-500'" [pTooltip]="a.summary"></i>
                      }
                      <span class="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white shrink-0" [class]="avatarColor(o.salesperson)"
                        [pTooltip]="o.salesperson || 'Unassigned'">{{ initials(o.salesperson) }}</span>
                    </span>
                  </div>
                </div>
              }
              @if (!board()[col.key].length) { <div class="text-center text-[11px] text-surface-300 py-10 select-none">Drop here</div> }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ───── New opportunity dialog ───── -->
    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '34rem' }" header="New opportunity" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Opportunity *</label><input pInputText [(ngModel)]="form.name" class="w-full" placeholder="e.g. Office Design Project" /></div>
        <div><label class="lbl">Customer *</label><input pInputText [(ngModel)]="form.customer" class="w-full" /></div>
        <div><label class="lbl">Expected revenue (₹)</label><p-inputNumber [(ngModel)]="form.expectedRevenue" [min]="0" mode="decimal" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Contact name</label><input pInputText [(ngModel)]="form.contactName" class="w-full" /></div>
        <div><label class="lbl">Email</label><input pInputText [(ngModel)]="form.email" class="w-full" /></div>
        <div><label class="lbl">Phone</label><input pInputText [(ngModel)]="form.phone" class="w-full" /></div>
        <div><label class="lbl">Salesperson</label><p-select [(ngModel)]="form.salesperson" [options]="teamOptions" optionLabel="label" optionValue="value" class="w-full" [showClear]="true" placeholder="Assign"></p-select></div>
        <div><label class="lbl">Stage</label><p-select [(ngModel)]="form.stage" [options]="stageOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Expected closing</label><p-datepicker [(ngModel)]="form.closing" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
        <div class="col-span-2"><label class="lbl">Tags (comma separated)</label><input pInputText [(ngModel)]="form.tags" class="w-full" placeholder="Design, Product" /></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Create" icon="pi pi-check" (click)="create()"></button>
      </ng-template>
    </p-dialog>

    <!-- ───── Opportunity detail dialog ───── -->
    <p-dialog [(visible)]="detailVisible" [modal]="true" [style]="{ width: '56rem' }" [draggable]="false" [dismissableMask]="true" styleClass="!max-w-[95vw]">
      @if (selected(); as o) {
        <ng-template pTemplate="header">
          <div class="flex items-center gap-3">
            <span class="text-base font-semibold">{{ o.name }}</span>
            <span class="text-xs text-surface-400">{{ o.code }}</span>
          </div>
        </ng-template>

        <!-- stage bar + actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 text-xs">
            @for (st of stages; track st.key) {
              <button class="px-3 py-1.5 transition relative"
                [class]="o.stage === st.key ? 'bg-brand-600 text-white font-medium' : 'bg-white dark:bg-surface-900 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800'"
                (click)="setStage(o, st.key)">{{ st.label }}</button>
            }
          </div>
          <div class="flex items-center gap-2">
            <button pButton size="small" severity="success" outlined icon="pi pi-check" label="Won" (click)="setStage(o, 'Won')"></button>
            <button pButton size="small" severity="danger" outlined icon="pi pi-times" label="Lost" (click)="setStage(o, 'Lost')"></button>
            <button pButton size="small" icon="pi pi-file-edit" label="New Quotation" (click)="newQuotation(o)"></button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <!-- left: facts -->
          <div class="lg:col-span-2 space-y-4">
            <div class="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div class="text-[11px] uppercase tracking-wide text-surface-400">Expected Revenue</div>
                <div class="text-xl font-semibold tabular-nums">{{ o.expectedRevenue | inr }}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wide text-surface-400">Probability</div>
                <div class="text-xl font-semibold tabular-nums">{{ o.probability }}%</div>
              </div>
              <div><div class="text-[11px] uppercase tracking-wide text-surface-400">Customer</div><div class="text-sm">{{ o.customer }}</div></div>
              <div><div class="text-[11px] uppercase tracking-wide text-surface-400">Salesperson</div><div class="text-sm">{{ o.salesperson || '—' }}</div></div>
              <div><div class="text-[11px] uppercase tracking-wide text-surface-400">Email</div><div class="text-sm">{{ o.email || '—' }}</div></div>
              <div><div class="text-[11px] uppercase tracking-wide text-surface-400">Phone</div><div class="text-sm">{{ o.phone || '—' }}</div></div>
              <div><div class="text-[11px] uppercase tracking-wide text-surface-400">Expected Closing</div><div class="text-sm">{{ o.expectedClosing ? (o.expectedClosing | date: 'dd MMM yyyy') : '—' }}</div></div>
              <div>
                <div class="text-[11px] uppercase tracking-wide text-surface-400">Priority</div>
                <div class="flex items-center gap-0.5 mt-0.5">
                  @for (star of [1,2,3]; track star) {
                    <i class="pi cursor-pointer text-sm" [class]="star <= o.priority ? 'pi-star-fill text-amber-400' : 'pi-star text-surface-300'" (click)="setPriority(o, star)"></i>
                  }
                </div>
              </div>
            </div>
            @if (o.tags.length) {
              <div class="flex flex-wrap gap-1.5">
                @for (t of o.tags; track t) { <span class="text-[11px] px-2 py-0.5 rounded-full" [class]="tagClass(t)">{{ t }}</span> }
              </div>
            }
            @if (o.description) { <p class="text-sm text-surface-600 dark:text-surface-300 whitespace-pre-line">{{ o.description }}</p> }
          </div>

          <!-- right: activities / follow-ups (chatter) -->
          <div class="border-l border-surface-100 dark:border-surface-800 pl-5">
            <div class="flex items-center justify-between mb-2">
              <div class="section-title">Activities</div>
              <button pButton size="small" text icon="pi pi-plus" label="Schedule" (click)="openSchedule(o)"></button>
            </div>
            <div class="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              @for (a of timeline(o); track a.index) {
                <div class="flex gap-2.5">
                  <span class="w-6 h-6 rounded-full grid place-items-center shrink-0 text-[11px]"
                    [class]="a.done ? 'bg-surface-100 dark:bg-surface-800 text-surface-400' : (overdueAct(a) ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10')">
                    <i class="pi {{ activityMeta[a.kind]?.icon || 'pi-bell' }}"></i>
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="text-[13px] text-surface-700 dark:text-surface-200 leading-snug" [class.line-through]="a.done" [class.text-surface-400]="a.done">{{ a.summary }}</div>
                    <div class="text-[11px] text-surface-400 flex items-center gap-2">
                      @if (a.dueDate && !a.done) { <span [class.text-rose-500]="overdueAct(a)">Due {{ a.dueDate | date: 'dd MMM' }}</span> }
                      <span>{{ a.by || 'system' }}</span>
                      @if (!a.done && a.kind !== 'stage') { <button class="text-brand-600 hover:underline" (click)="markDone(o, a)">Mark done</button> }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </p-dialog>

    <!-- ───── Schedule activity dialog ───── -->
    <p-dialog [(visible)]="scheduleVisible" [modal]="true" [style]="{ width: '26rem' }" header="Schedule an activity" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-3">
        <div><label class="lbl">Type</label><p-select [(ngModel)]="act.kind" [options]="activityOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Summary *</label><input pInputText [(ngModel)]="act.summary" class="w-full" placeholder="e.g. Call to get system requirements" /></div>
        <div><label class="lbl">Due date</label><p-datepicker [(ngModel)]="act.due" dateFormat="dd M yy" class="w-full" [showIcon]="true" appendTo="body"></p-datepicker></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="scheduleVisible = false"></button>
        <button pButton label="Schedule" icon="pi pi-check" (click)="saveActivity()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class CrmPipelineComponent {
  private readonly svc = inject(SalesService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);

  protected readonly stages = SALES_STAGES;
  protected readonly activityMeta = ACTIVITY_META;
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly stageOptions = SALES_STAGES.map((s) => ({ label: s.label, value: s.key }));
  protected readonly activityOptions = ['call', 'meeting', 'email', 'quotation', 'todo'].map((k) => ({ label: ACTIVITY_META[k].label, value: k }));

  protected search = '';
  protected readonly board = signal<Board>({ New: [], Qualified: [], Proposition: [], Won: [], Lost: [] });
  protected readonly summary = signal<CrmSummary | null>(null);
  protected readonly selected = signal<Opportunity | null>(null);

  protected createVisible = false;
  protected detailVisible = false;
  protected scheduleVisible = false;
  protected form = this.blankForm();
  protected act = { kind: 'call', summary: '', due: null as Date | null };

  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Pipeline', value: this.compact(s?.pipelineValue ?? 0), caption: `${s?.totalOpen ?? 0} open`, tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Weighted', value: this.compact(s?.weightedValue ?? 0), caption: 'by probability', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Won', value: this.compact(s?.wonValue ?? 0), caption: `${s?.won ?? 0} deals`, tone: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Lost', value: s?.lost ?? 0, caption: 'opportunities', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  constructor() {
    this.reload();
  }

  private reload() {
    this.svc.opportunities({ search: this.search || null }).subscribe((list) => this.group(list));
    this.svc.crmSummary().subscribe((s) => this.summary.set(s));
  }

  private group(list: Opportunity[]) {
    const b: Board = { New: [], Qualified: [], Proposition: [], Won: [], Lost: [] };
    for (const o of list) (b[o.stage] ?? b.New).push(o);
    this.board.set(b);
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 250);
  }

  colSum(stage: SalesStage): number { return this.board()[stage].reduce((a, o) => a + o.expectedRevenue, 0); }
  colPct(stage: SalesStage): number {
    const max = Math.max(...this.stages.map((s) => this.colSum(s.key)), 1);
    return Math.round((this.colSum(stage) / max) * 100);
  }

  drop(event: CdkDragDrop<Opportunity[]>, target: SalesStage) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.board.set({ ...this.board() });
      return;
    }
    const o = event.previousContainer.data[event.previousIndex];
    if (target === o.stage) return;
    // optimistic move
    event.previousContainer.data.splice(event.previousIndex, 1);
    event.container.data.splice(event.currentIndex, 0, { ...o, stage: target });
    this.board.set({ ...this.board() });
    this.svc.moveStage(o.id, target).subscribe({
      next: () => { this.messages.add({ severity: 'success', summary: 'Moved', detail: `${o.name} → ${target}` }); this.svc.crmSummary().subscribe((s) => this.summary.set(s)); },
      error: () => { this.messages.add({ severity: 'error', summary: 'Move failed' }); this.reload(); }
    });
  }

  // ── detail ──
  openDetail(o: Opportunity) { this.selected.set(o); this.detailVisible = true; }

  setStage(o: Opportunity, stage: SalesStage) {
    this.svc.moveStage(o.id, stage).subscribe((updated) => { this.selected.set(updated); this.patch(updated); this.messages.add({ severity: 'success', summary: `Moved to ${stage}` }); });
  }
  setPriority(o: Opportunity, priority: number) {
    const p = o.priority === priority ? priority - 1 : priority;
    this.svc.updateOpportunity(o.id, { priority: p }).subscribe((u) => { this.selected.set(u); this.patch(u); });
  }
  newQuotation(o: Opportunity) {
    this.detailVisible = false;
    this.router.navigate(['/sales/quotations'], { queryParams: { customer: o.customer, oppId: o.id, email: o.email ?? '' } });
  }

  // ── schedule activity ──
  openSchedule(o: Opportunity) { this.selected.set(o); this.act = { kind: 'call', summary: '', due: null }; this.scheduleVisible = true; }
  saveActivity() {
    const o = this.selected();
    if (!o || !this.act.summary.trim()) { this.messages.add({ severity: 'warn', summary: 'Summary is required' }); return; }
    this.svc.addActivity(o.id, { kind: this.act.kind, summary: this.act.summary.trim(), dueDate: this.toIso(this.act.due) }).subscribe((u) => {
      this.selected.set(u); this.patch(u); this.scheduleVisible = false; this.messages.add({ severity: 'success', summary: 'Activity scheduled' });
    });
  }
  markDone(o: Opportunity, a: SalesActivity) {
    this.svc.completeActivity(o.id, a.index).subscribe((u) => { this.selected.set(u); this.patch(u); });
  }

  // ── create ──
  openCreate() { this.form = this.blankForm(); this.createVisible = true; }
  create() {
    if (!this.form.name.trim() || !this.form.customer.trim()) { this.messages.add({ severity: 'warn', summary: 'Name and customer are required' }); return; }
    this.svc.createOpportunity({
      name: this.form.name.trim(), customer: this.form.customer.trim(), stage: this.form.stage,
      expectedRevenue: this.form.expectedRevenue ?? 0, contactName: this.form.contactName || null, email: this.form.email || null,
      phone: this.form.phone || null, salesperson: this.form.salesperson || null, expectedClosing: this.toIso(this.form.closing),
      tags: this.form.tags ? this.form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    } as never).subscribe(() => { this.createVisible = false; this.reload(); this.messages.add({ severity: 'success', summary: 'Opportunity created' }); });
  }

  // ── helpers ──
  private patch(u: Opportunity) {
    const list = Object.values(this.board()).flat().map((o) => (o.id === u.id ? u : o));
    this.group(list);
  }
  timeline(o: Opportunity): SalesActivity[] { return [...(o.activities ?? [])].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1) || +new Date(b.at) - +new Date(a.at)); }
  nextActivity(o: Opportunity): SalesActivity | null { return (o.activities ?? []).find((a) => !a.done && a.kind !== 'stage') ?? null; }
  overdueAct(a: SalesActivity): boolean { return !!a.dueDate && !a.done && new Date(a.dueDate) < new Date(new Date().toDateString()); }
  initials(name?: string | null): string { return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(); }
  avatarColor(name?: string | null): string {
    const colors = ['bg-brand-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    const i = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
    return colors[i];
  }
  tagClass(tag: string): string {
    const palette = [
      'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
      'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
      'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
    ];
    const i = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
    return palette[i];
  }
  private compact(v: number): string { return new InrPipe().transform(v, 'compact'); }
  private toIso(d: Date | null): string | null { return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; }
  private blankForm() {
    return { name: '', customer: '', expectedRevenue: 0 as number | null, contactName: '', email: '', phone: '', salesperson: '' as string, stage: 'New' as SalesStage, closing: null as Date | null, tags: '' };
  }
}
