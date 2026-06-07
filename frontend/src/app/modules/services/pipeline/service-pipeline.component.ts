import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import { ServicesService } from '../services.service';
import {
  SERVICE_STAGES, SERVICE_TYPE_META, ServiceOrder, ServicePriority, ServiceStage, ServiceSummary, ServiceType
} from '../models';

const TEAM = ['Sahil Verma', 'Rohit Sharma', 'Anjali Gupta'];

@Component({
  selector: 'app-service-pipeline',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, DragDropModule,
    ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, TextareaModule, DatePickerModule, TooltipModule,
    PageHeaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Services" [title]="title()" [subtitle]="subtitle()">
      <button pButton severity="secondary" outlined icon="pi pi-plus" label="New order" (click)="openCreate()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[26px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    @if (!routeType()) {
      <div class="flex flex-wrap items-center gap-1.5 mb-3">
        <button class="px-2.5 py-1 rounded-full text-xs border transition"
          [class]="!typeFilter() ? 'bg-surface-800 text-white border-surface-800 dark:bg-surface-100 dark:text-surface-900' : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300'"
          (click)="setType(null)">All</button>
        @for (t of types; track t) {
          <button class="px-2.5 py-1 rounded-full text-xs border transition inline-flex items-center gap-1.5"
            [class]="typeFilter() === t ? 'bg-surface-800 text-white border-surface-800 dark:bg-surface-100 dark:text-surface-900' : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300'"
            (click)="setType(t)"><i class="pi {{ meta[t].icon }} text-[10px]"></i>{{ meta[t].label }}</button>
        }
      </div>
    }

    <div class="card p-2">
      <div class="flex gap-4 overflow-x-auto pb-1" cdkDropListGroup>
        @for (col of stages; track col.key) {
          <div class="min-w-[256px] flex-1 flex flex-col">
            <div class="flex items-center gap-2 mb-3 px-1">
              <span class="w-1.5 h-1.5 rounded-full" [class]="col.dot"></span>
              <span class="text-[13px] font-medium text-surface-700 dark:text-surface-200">{{ col.label }}</span>
              <span class="text-xs text-surface-400 tabular-nums">{{ lists()[col.key].length }}</span>
            </div>
            <div class="rounded-xl p-1.5 space-y-2 flex-1 min-h-[320px] bg-surface-50/60 dark:bg-surface-900/30"
              cdkDropList [cdkDropListData]="lists()[col.key]" (cdkDropListDropped)="drop($event, col.key)">
              @for (o of lists()[col.key]; track o.id) {
                <div class="bg-white dark:bg-surface-900 rounded-lg p-3 border border-surface-200/80 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm transition cursor-pointer"
                  cdkDrag (click)="openDetail(o)">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-[13px] font-medium text-surface-800 dark:text-surface-100 truncate">{{ o.title }}</div>
                      <div class="text-[11px] text-surface-500 truncate mt-0.5">{{ o.code }} · {{ o.customer }}</div>
                    </div>
                    <span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" [class]="priorityDot(o.priority)" [pTooltip]="o.priority + ' priority'"></span>
                  </div>

                  <div class="mt-2 flex items-center flex-wrap gap-1.5 text-[11px] text-surface-400">
                    @if (!routeType()) {
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500"><i class="pi {{ meta[o.type].icon }} text-[9px]"></i>{{ meta[o.type].label }}</span>
                    }
                    @if (o.dueAt) {
                      <span [class]="overdue(o) ? 'text-rose-500' : 'text-surface-400'"><i class="pi pi-flag text-[9px]"></i> {{ o.dueAt | date: 'd MMM' }}</span>
                    }
                  </div>

                  @if (o.estimatedHours > 0) {
                    <div class="mt-2">
                      <div class="h-1 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                        <div class="h-full rounded-full bg-brand-500" [style.width.%]="o.progress"></div>
                      </div>
                      <div class="text-[10px] text-surface-400 mt-1">{{ o.loggedHours | number: '1.0-1' }} / {{ o.estimatedHours | number: '1.0-0' }}h</div>
                    </div>
                  }

                  <div class="mt-2.5 pt-2.5 border-t border-surface-100 dark:border-surface-800/70 flex items-center justify-between">
                    @if (o.assignedTo) {
                      <span class="text-[11px] text-surface-500 inline-flex items-center gap-1 min-w-0"><i class="pi pi-user text-[10px] text-surface-400"></i><span class="truncate">{{ o.assignedTo }}</span></span>
                    } @else {
                      <span class="text-[11px] text-surface-300">Unassigned</span>
                    }
                    @if (o.scheduledAt) { <span class="text-[10px] text-surface-400">{{ o.scheduledAt | date: 'd MMM, h:mm a' }}</span> }
                  </div>
                </div>
              }
              @if (!lists()[col.key].length) { <div class="text-center text-[11px] text-surface-300 py-8 select-none">—</div> }
            </div>
          </div>
        }
      </div>
      <p class="text-[11px] text-surface-400 mt-3 px-1"><i class="pi pi-info-circle mr-1"></i>Drag an order across stages — moving to Scheduled prompts you to assign and schedule. Click an order for full tracking.</p>
    </div>

    <!-- Detail -->
    <p-dialog [(visible)]="detailVisible" [modal]="true" [style]="{ width: '40rem' }" [header]="detail()?.title || ''" [draggable]="false" [dismissableMask]="true">
      @if (detail(); as o) {
        <div class="space-y-4 pt-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300"><i class="pi {{ meta[o.type].icon }} text-[10px]"></i>{{ meta[o.type].label }}</span>
            <span class="text-xs px-2 py-0.5 rounded-full" [class]="priorityChip(o.priority)">{{ o.priority }}</span>
            <span class="text-xs text-surface-400">{{ o.code }}</span>
            <span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">{{ stageLabel(o.stage) }}</span>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt class="text-[11px] uppercase text-surface-400">Customer</dt><dd class="font-medium">{{ o.customer }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Assigned to</dt><dd class="font-medium">{{ o.assignedTo || '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Scheduled</dt><dd class="font-medium">{{ o.scheduledAt ? (o.scheduledAt | date: 'medium') : '—' }}</dd></div>
            <div><dt class="text-[11px] uppercase text-surface-400">Due</dt><dd class="font-medium" [class.text-rose-500]="overdue(o)">{{ o.dueAt ? (o.dueAt | date: 'mediumDate') : '—' }}</dd></div>
          </dl>

          @if (o.tags?.length) {
            <div class="flex flex-wrap gap-1.5">
              @for (t of o.tags; track t) { <span class="text-[11px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">{{ t }}</span> }
            </div>
          }

          <!-- Assignment -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3 flex items-center justify-between">
            <div>
              <div class="section-title">Assignment</div>
              <div class="text-sm mt-0.5">
                @if (o.assignedTo) { <span class="font-medium">{{ o.assignedTo }}</span> } @else { <span class="text-surface-400">Not assigned</span> }
                @if (o.scheduledAt) { <span class="text-surface-500 text-xs"> · {{ o.scheduledAt | date: 'd MMM, h:mm a' }}</span> }
              </div>
            </div>
            <button pButton size="small" outlined icon="pi pi-user-plus" [label]="o.assignedTo ? 'Reassign' : 'Assign'" (click)="openAssign(o)"></button>
          </div>

          <!-- Time tracking -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="section-title">Time tracking</div>
              <button pButton size="small" outlined icon="pi pi-clock" label="Log time" (click)="openLog(o)"></button>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <span class="font-medium tabular-nums">{{ o.loggedHours | number: '1.0-1' }}h</span>
              <span class="text-surface-400 text-xs">logged of {{ o.estimatedHours | number: '1.0-0' }}h estimated</span>
              @if (o.estimatedHours > 0) {
                <div class="flex-1 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                  <div class="h-full rounded-full bg-brand-500" [style.width.%]="o.progress"></div>
                </div>
              }
            </div>
            @if (o.timesheets?.length) {
              <div class="mt-2 space-y-1">
                @for (t of o.timesheets; track t.id) {
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-surface-600 dark:text-surface-300">{{ t.person }} <span class="text-surface-400">· {{ t.date | date: 'd MMM' }}</span></span>
                    <span class="text-surface-500 tabular-nums">{{ t.hours | number: '1.0-1' }}h<span class="text-surface-400"> {{ t.note }}</span></span>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Activity timeline -->
          <div class="rounded-xl border border-surface-200 dark:border-surface-800 p-3">
            <div class="section-title mb-2">Activity</div>
            @if (o.activity?.length) {
              <ul class="space-y-2">
                @for (a of o.activity; track $index) {
                  <li class="flex gap-2 text-xs">
                    <i class="pi mt-0.5 text-[10px] text-surface-400" [class]="activityIcon(a.kind)"></i>
                    <div class="min-w-0">
                      <div class="text-surface-700 dark:text-surface-200">
                        @if (a.kind === 'move') { Moved <span class="font-medium">{{ stageLabel(a.from) }}</span> → <span class="font-medium">{{ stageLabel(a.to) }}</span> } @else { {{ a.note }} }
                      </div>
                      @if (a.kind === 'move' && a.note) { <div class="text-surface-500">“{{ a.note }}”</div> }
                      <div class="text-[10px] text-surface-400">{{ a.by || '—' }} · {{ a.at | date: 'medium' }}</div>
                    </div>
                  </li>
                }
              </ul>
            } @else { <div class="text-xs text-surface-400">No activity yet.</div> }
          </div>

          <!-- Advance stage -->
          <div class="rounded-xl bg-surface-50 dark:bg-surface-900/40 p-3">
            <label class="text-xs font-medium text-surface-600">Move to stage</label>
            <div class="flex gap-2 mt-1">
              <p-select [options]="stageOptions" [(ngModel)]="moveStage" optionLabel="label" optionValue="value" styleClass="flex-1 !rounded-lg" appendTo="body" />
              <button pButton label="Go" icon="pi pi-arrow-right" [disabled]="moveStage === o.stage" (click)="advance(o)"></button>
            </div>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Close" (click)="detailVisible = false"></button>
      </ng-template>
    </p-dialog>

    <!-- Assign / Log-time action dialog -->
    <p-dialog [(visible)]="actVisible" [modal]="true" [style]="{ width: '30rem' }" [header]="actTitle" [draggable]="false" [dismissableMask]="false">
      <div class="space-y-3 pt-1">
        @if (actMode === 'assign') {
          <div>
            <label class="text-xs font-medium text-surface-600">Assign to</label>
            <p-select [options]="teamOptions" [(ngModel)]="actPerson" [editable]="true" [filter]="true" placeholder="Technician / agent" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Scheduled date &amp; time</label>
            <p-datePicker [(ngModel)]="actDate" [showTime]="true" hourFormat="12" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
          </div>
        }
        @if (actMode === 'time') {
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="text-xs font-medium text-surface-600">Who</label>
              <p-select [options]="teamOptions" [(ngModel)]="actPerson" [editable]="true" [filter]="true" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">Hours</label>
              <p-inputNumber [(ngModel)]="actHours" [min]="0.25" [max]="24" [step]="0.25" [minFractionDigits]="0" [maxFractionDigits]="2" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
            </div>
            <div>
              <label class="text-xs font-medium text-surface-600">Date</label>
              <p-datePicker [(ngModel)]="actDate" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
            </div>
          </div>
        }
        <div>
          <label class="text-xs font-medium text-surface-600">Note (optional)</label>
          <textarea pTextarea [(ngModel)]="actNote" rows="2" class="w-full mt-1 !rounded-lg"></textarea>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="cancelAction()"></button>
        <button pButton [label]="actConfirm" icon="pi pi-check" [loading]="saving()" [disabled]="!actionValid()" (click)="confirmAction()"></button>
      </ng-template>
    </p-dialog>

    <!-- New order -->
    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '34rem' }" header="New service order" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Title</label>
          <input pInputText [(ngModel)]="form.title" class="w-full mt-1 !rounded-lg" placeholder="What needs doing?" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Type</label>
          <p-select [options]="typeOptions" [(ngModel)]="form.type" optionLabel="label" optionValue="value" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Priority</label>
          <p-select [options]="priorityOptions" [(ngModel)]="form.priority" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Customer</label>
          <input pInputText [(ngModel)]="form.customer" class="w-full mt-1 !rounded-lg" placeholder="Customer name" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Estimated hours</label>
          <p-inputNumber [(ngModel)]="form.estimatedHours" [min]="0" [max]="2000" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Due date</label>
          <p-datePicker [(ngModel)]="form.due" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Assign to (optional)</label>
          <p-select [options]="teamOptions" [(ngModel)]="form.assignedTo" [editable]="true" [showClear]="true" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-surface-600">Description</label>
          <textarea pTextarea [(ngModel)]="form.description" rows="2" class="w-full mt-1 !rounded-lg"></textarea>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Create order" [disabled]="!form.title.trim() || !form.customer.trim()" (click)="submitCreate()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class ServicePipelineComponent {
  private readonly svc = inject(ServicesService);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);

  protected readonly stages = SERVICE_STAGES;
  protected readonly meta = SERVICE_TYPE_META;
  protected readonly types: ServiceType[] = ['Project', 'FieldService', 'Helpdesk', 'Appointment'];
  protected readonly teamOptions = TEAM.map((t) => ({ label: t, value: t }));
  protected readonly typeOptions = this.types.map((t) => ({ label: this.meta[t].label, value: t }));
  protected readonly priorityOptions: ServicePriority[] = ['Low', 'Medium', 'High', 'Urgent'];
  protected readonly stageOptions = SERVICE_STAGES.map((s) => ({ label: s.label, value: s.key }));

  protected readonly routeType = signal<ServiceType | null>(null);
  protected readonly typeFilter = signal<ServiceType | null>(null);
  protected readonly title = signal('Service pipeline');
  protected readonly subtitle = computed(() =>
    this.routeType()
      ? `${this.meta[this.routeType()!].label} orders — drag across stages, assign owners and track time.`
      : 'All service orders across Project, Field Service, Helpdesk and Appointments.');

  protected readonly lists = signal<Record<ServiceStage, ServiceOrder[]>>({ new: [], scheduled: [], inprogress: [], review: [], done: [], cancelled: [] });
  protected readonly summary = signal<ServiceSummary | null>(null);

  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Total orders', value: s?.totalOrders ?? 0, caption: 'in this view', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Open', value: s?.open ?? 0, caption: 'in progress', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Overdue', value: s?.overdue ?? 0, caption: 'past due date', tone: (s?.overdue ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100' },
      { label: 'Hours logged', value: (s?.loggedHours ?? 0).toFixed(1), caption: 'across all orders', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  detailVisible = false;
  protected readonly detail = signal<ServiceOrder | null>(null);
  moveStage: ServiceStage = 'new';

  // action dialog (assign / log time)
  actVisible = false;
  actMode: 'assign' | 'time' = 'assign';
  actTitle = '';
  actConfirm = 'Save';
  protected readonly saving = signal(false);
  actOrderId: string | null = null;
  actPerson = '';
  actDate: Date | null = null;
  actHours = 1;
  actNote = '';
  pendingStage: ServiceStage | null = null;   // when an assign is part of a drag-to-scheduled

  createVisible = false;
  form = this.blankForm();

  constructor() {
    this.route.data.subscribe((d) => {
      this.routeType.set((d['type'] as ServiceType) ?? null);
      this.title.set((d['title'] as string) ?? 'Service pipeline');
      this.typeFilter.set(null);
      this.reload();
    });
  }

  private effectiveType(): ServiceType | null { return this.routeType() ?? this.typeFilter(); }

  reload() {
    this.svc.orders({ type: this.effectiveType() }).subscribe((orders) => this.group(orders));
    this.svc.summary().subscribe((s) => this.summary.set(this.scopeSummary(s)));
  }

  /** When viewing a single type, scope the headline numbers to that type. */
  private scopeSummary(s: ServiceSummary): ServiceSummary {
    const t = this.effectiveType();
    if (!t) return s;
    const row = s.byType.find((x) => x.type === t);
    const orders = Object.values(this.lists()).flat();
    return { ...s, totalOrders: row?.total ?? 0, open: row?.open ?? 0,
      overdue: orders.filter((o) => this.overdue(o)).length,
      loggedHours: orders.reduce((a, o) => a + o.loggedHours, 0) };
  }

  setType(t: ServiceType | null) { this.typeFilter.set(t); this.reload(); }

  private group(orders: ServiceOrder[]) {
    const map: Record<ServiceStage, ServiceOrder[]> = { new: [], scheduled: [], inprogress: [], review: [], done: [], cancelled: [] };
    for (const o of orders) (map[o.stage] ?? map.new).push(o);
    this.lists.set(map);
    if (this.effectiveType() && this.summary()) this.summary.set(this.scopeSummary(this.summary()!));
  }

  // ---- drag & drop ----
  drop(event: CdkDragDrop<ServiceOrder[]>, target: ServiceStage) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.lists.set({ ...this.lists() });
      return;
    }
    const o = event.previousContainer.data[event.previousIndex];
    if (target === o.stage) return;
    // Moving to Scheduled without an owner → capture assignment first (the move follows on confirm).
    if (target === 'scheduled' && !o.assignedTo) {
      this.pendingStage = 'scheduled';
      this.openAssign(o);
      return;
    }
    this.persistMove(o, target);
  }

  private persistMove(o: ServiceOrder, stage: ServiceStage) {
    this.svc.move(o.id, stage).subscribe({
      next: (updated) => {
        this.patch(updated);
        this.messages.add({ severity: 'success', summary: 'Moved', detail: `${o.title} → ${this.stageLabel(stage)}` });
      },
      error: () => { this.messages.add({ severity: 'error', summary: 'Move failed' }); this.reload(); }
    });
  }

  advance(o: ServiceOrder) {
    if (this.moveStage === o.stage) return;
    if (this.moveStage === 'scheduled' && !o.assignedTo) { this.pendingStage = 'scheduled'; this.openAssign(o); this.detailVisible = false; return; }
    this.persistMove(o, this.moveStage);
    this.detailVisible = false;
  }

  // ---- assignment / time ----
  openAssign(o: ServiceOrder) {
    this.actOrderId = o.id; this.actMode = 'assign'; this.actTitle = 'Assign & schedule'; this.actConfirm = 'Save';
    this.actPerson = o.assignedTo ?? ''; this.actDate = o.scheduledAt ? new Date(o.scheduledAt) : null; this.actNote = '';
    this.actVisible = true;
  }
  openLog(o: ServiceOrder) {
    this.actOrderId = o.id; this.actMode = 'time'; this.actTitle = 'Log time'; this.actConfirm = 'Log time';
    this.actPerson = o.assignedTo ?? ''; this.actHours = 1; this.actDate = new Date(); this.actNote = '';
    this.actVisible = true;
  }
  actionValid(): boolean { return this.actMode === 'assign' ? !!this.actPerson?.trim() : !!this.actPerson?.trim() && this.actHours > 0; }
  cancelAction() { this.actVisible = false; this.pendingStage = null; }

  confirmAction() {
    const id = this.actOrderId; if (!id || !this.actionValid()) return;
    this.saving.set(true);
    const done = (updated: ServiceOrder, msg: string) => {
      this.saving.set(false); this.actVisible = false;
      const stage = this.pendingStage; this.pendingStage = null;
      this.patch(updated);
      this.messages.add({ severity: 'success', summary: msg });
      if (stage && updated.stage !== stage) this.persistMove(updated, stage);
    };
    if (this.actMode === 'assign') {
      this.svc.assign(id, { assignedTo: this.actPerson.trim(), scheduledAt: this.actDate ? this.actDate.toISOString() : null, note: this.actNote?.trim() || null })
        .subscribe({ next: (u) => done(u, 'Assigned'), error: () => { this.saving.set(false); this.messages.add({ severity: 'error', summary: 'Assign failed' }); } });
    } else {
      this.svc.logTime(id, { person: this.actPerson.trim(), hours: this.actHours, date: this.actDate ? this.toIso(this.actDate) : null, note: this.actNote?.trim() || null })
        .subscribe({ next: (u) => done(u, 'Time logged'), error: () => { this.saving.set(false); this.messages.add({ severity: 'error', summary: 'Log failed' }); } });
    }
  }

  // ---- detail ----
  openDetail(o: ServiceOrder) {
    this.detail.set(o); this.moveStage = o.stage; this.detailVisible = true;
    this.svc.order(o.id).subscribe((full) => { if (this.detail()?.id === o.id) this.detail.set(full); });
  }

  // ---- create ----
  openCreate() { this.form = this.blankForm(); if (this.routeType()) this.form.type = this.routeType()!; this.createVisible = true; }
  submitCreate() {
    const f = this.form;
    this.svc.create({
      title: f.title.trim(), customer: f.customer.trim(), type: f.type, priority: f.priority,
      estimatedHours: f.estimatedHours, dueAt: f.due ? this.toIso(f.due) : null,
      assignedTo: f.assignedTo?.trim() || null, description: f.description?.trim() || null
    } as never).subscribe({
      next: () => { this.messages.add({ severity: 'success', summary: 'Order created', detail: f.title }); this.createVisible = false; this.reload(); },
      error: () => this.messages.add({ severity: 'error', summary: 'Could not create order' })
    });
  }

  // ---- helpers ----
  private patch(updated: ServiceOrder) {
    const map = this.lists();
    for (const k of Object.keys(map) as ServiceStage[]) map[k] = map[k].filter((x) => x.id !== updated.id);
    (map[updated.stage] ?? map.new).unshift(updated);
    this.lists.set({ ...map });
    if (this.detail()?.id === updated.id) this.detail.set(updated);
    this.svc.summary().subscribe((s) => this.summary.set(this.scopeSummary(s)));
  }

  private toIso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

  overdue(o: ServiceOrder): boolean {
    if (!o.dueAt || o.stage === 'done' || o.stage === 'cancelled') return false;
    return new Date(o.dueAt) < new Date(new Date().toDateString());
  }
  stageLabel(s?: ServiceStage | string): string { return SERVICE_STAGES.find((x) => x.key === s)?.label ?? (s ?? ''); }
  priorityDot(p: ServicePriority): string { return ({ Low: 'bg-surface-300', Medium: 'bg-brand-400', High: 'bg-amber-500', Urgent: 'bg-rose-500' } as Record<ServicePriority, string>)[p]; }
  priorityChip(p: ServicePriority): string {
    return ({ Low: 'bg-surface-100 text-surface-500 dark:bg-surface-800', Medium: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
      High: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', Urgent: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' } as Record<ServicePriority, string>)[p];
  }
  activityIcon(kind: string): string {
    return ({ create: 'pi-plus-circle', move: 'pi-arrow-right', assign: 'pi-user-plus', time: 'pi-clock', note: 'pi-pencil' } as Record<string, string>)[kind] ?? 'pi-circle-fill';
  }

  private blankForm() {
    return { title: '', type: 'Project' as ServiceType, priority: 'Medium' as ServicePriority, customer: '', estimatedHours: 8, due: null as Date | null, assignedTo: '' as string | null, description: '' };
  }
}
