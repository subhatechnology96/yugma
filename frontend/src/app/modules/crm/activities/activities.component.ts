import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { CrmService, ActivityInput } from '../services/crm.service';
import { DealService } from '../services/deal.service';
import { Activity, ActivityType } from '../models/crm.models';

const OWNERS = ['Vikram Singh', 'Meera Krishnan', 'Arjun Trivedi'];

@Component({
  selector: 'app-crm-activities',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, FormsModule, TableModule, ButtonModule, SelectModule, DialogModule, InputTextModule, TooltipModule, PageHeaderComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="CRM" title="Activities" subtitle="Calls, emails, meetings and tasks across your pipeline.">
      <div class="flex items-center rounded-lg border border-surface-200 dark:border-surface-800 p-0.5">
        <button type="button" (click)="view.set('list')" class="px-3 py-1.5 text-sm rounded-md font-medium" [class.bg-brand-600]="view() === 'list'" [class.text-white]="view() === 'list'" [class.text-surface-600]="view() !== 'list'"><i class="pi pi-list text-xs mr-1"></i> List</button>
        <button type="button" (click)="view.set('calendar')" class="px-3 py-1.5 text-sm rounded-md font-medium" [class.bg-brand-600]="view() === 'calendar'" [class.text-white]="view() === 'calendar'" [class.text-surface-600]="view() !== 'calendar'"><i class="pi pi-calendar text-xs mr-1"></i> Calendar</button>
      </div>
      <button pButton icon="pi pi-plus" label="New activity" (click)="dialogVisible = true"></button>
    </app-page-header>

    @if (view() === 'list') {
      <div class="card">
        <p-table [value]="activities()" [paginator]="true" [rows]="12" responsiveLayout="scroll" [rowHover]="true">
          <ng-template pTemplate="header">
            <tr class="!bg-surface-50 dark:!bg-surface-900/40">
              <th class="!text-xs !uppercase">Type</th>
              <th class="!text-xs !uppercase">Subject</th>
              <th class="!text-xs !uppercase">Due</th>
              <th class="!text-xs !uppercase">Owner</th>
              <th class="!text-xs !uppercase">Status</th>
              <th class="!text-xs !uppercase !text-right">Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-a>
            <tr>
              <td><span class="inline-flex items-center gap-2 text-sm"><i class="pi {{ typeIcon(a.type) }} text-surface-500"></i>{{ a.type | titlecase }}</span></td>
              <td class="text-sm" [class.line-through]="a.status === 'done'" [class.text-surface-400]="a.status === 'done'">{{ a.subject }}</td>
              <td class="text-sm">{{ a.dueAt | date: 'MMM d, h:mm a' }}</td>
              <td class="text-sm">{{ a.owner }}</td>
              <td><app-status-pill [tone]="a.status === 'done' ? 'success' : 'warn'">{{ a.status | titlecase }}</app-status-pill></td>
              <td class="!text-right">
                @if (a.status === 'open') {
                  <button pButton size="small" text icon="pi pi-check" label="Done" (click)="markDone(a)"></button>
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    } @else {
      <div class="card p-5">
        <div class="text-lg font-semibold mb-4">{{ today | date: 'MMMM y' }}</div>
        <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          @for (b of leadingBlanks(); track b) { <div class="min-h-[84px]"></div> }
          @for (d of daysInMonth(); track d) {
            <div class="min-h-[84px] rounded-lg border border-surface-200 dark:border-surface-800 p-1.5 text-left"
              [class.ring-2]="d === today.getDate()" [class.ring-brand-400]="d === today.getDate()">
              <div class="text-xs font-semibold" [class.text-brand-600]="d === today.getDate()">{{ d }}</div>
              <div class="space-y-1 mt-1">
                @for (a of forDay(d); track a.id) {
                  <div class="text-[10px] px-1 py-0.5 rounded truncate"
                    [class.bg-brand-50]="a.status === 'open'" [class.text-brand-700]="a.status === 'open'"
                    [class.bg-surface-100]="a.status === 'done'" [class.text-surface-400]="a.status === 'done'"
                    [class.dark:bg-brand-500/10]="a.status === 'open'" [class.dark:bg-surface-800]="a.status === 'done'"
                    [pTooltip]="a.subject">
                    <i class="pi {{ typeIcon(a.type) }} text-[8px] mr-0.5"></i>{{ a.subject }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }

    <p-dialog [(visible)]="dialogVisible" [modal]="true" [style]="{ width: '30rem' }" header="New activity" [draggable]="false">
      <div class="space-y-3 pt-2">
        <div>
          <label class="text-xs font-medium text-surface-600">Type</label>
          <p-select [options]="typeOptions" [(ngModel)]="form.type" styleClass="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Subject</label>
          <input pInputText [(ngModel)]="form.subject" class="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Due</label>
          <input type="datetime-local" [(ngModel)]="form.dueAt" class="w-full mt-1 p-inputtext" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-surface-600">Owner</label>
            <p-select [options]="ownerOptions" [(ngModel)]="form.owner" styleClass="w-full mt-1" />
          </div>
          <div>
            <label class="text-xs font-medium text-surface-600">Related deal</label>
            <p-select [options]="dealOptions()" [(ngModel)]="form.relatedToId" placeholder="Select deal" styleClass="w-full mt-1" [filter]="true" />
          </div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="dialogVisible = false"></button>
        <button pButton label="Create" [disabled]="!form.subject || !form.relatedToId" (click)="create()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class CrmActivitiesComponent {
  protected readonly crm = inject(CrmService);
  private readonly dealSvc = inject(DealService);
  private readonly messages = inject(MessageService);

  readonly today = new Date();
  readonly view = signal<'list' | 'calendar'>('list');
  readonly activities = this.crm.activities;

  readonly typeOptions = [
    { label: 'Call', value: 'call' },
    { label: 'Email', value: 'email' },
    { label: 'Meeting', value: 'meeting' },
    { label: 'Task', value: 'task' }
  ];
  readonly ownerOptions = OWNERS.map((o) => ({ label: o, value: o }));
  readonly dealOptions = computed(() => this.dealSvc.deals().map((d) => ({ label: d.name, value: d.id })));

  dialogVisible = false;
  form = this.blank();

  constructor() {
    this.crm.loadActivities();
    this.dealSvc.load();
  }

  daysInMonth(): number[] {
    const last = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  leadingBlanks(): number[] {
    const offset = new Date(this.today.getFullYear(), this.today.getMonth(), 1).getDay();
    return Array.from({ length: offset }, (_, i) => i);
  }
  forDay(d: number): Activity[] {
    return this.activities().filter((a) => {
      const dt = new Date(a.dueAt);
      return dt.getFullYear() === this.today.getFullYear() && dt.getMonth() === this.today.getMonth() && dt.getDate() === d;
    });
  }

  markDone(a: Activity) {
    this.crm.markActivityDone(a.id).subscribe(() => this.messages.add({ severity: 'success', summary: 'Marked done', detail: a.subject }));
  }

  create() {
    const input: ActivityInput = {
      type: this.form.type,
      subject: this.form.subject,
      dueAt: this.form.dueAt ? new Date(this.form.dueAt).toISOString() : new Date().toISOString(),
      relatedToType: 'deal',
      relatedToId: this.form.relatedToId,
      owner: this.form.owner
    };
    this.crm.createActivity(input).subscribe((a) => {
      this.messages.add({ severity: 'success', summary: 'Activity created', detail: a.subject });
      this.dialogVisible = false;
      this.form = this.blank();
    });
  }

  typeIcon(type: string): string {
    return { call: 'pi-phone', email: 'pi-envelope', meeting: 'pi-users', task: 'pi-check-square' }[type] ?? 'pi-circle';
  }

  private blank(): { type: ActivityType; subject: string; dueAt: string; owner: string; relatedToId: string } {
    return { type: 'task', subject: '', dueAt: '', owner: OWNERS[0], relatedToId: '' };
  }
}
