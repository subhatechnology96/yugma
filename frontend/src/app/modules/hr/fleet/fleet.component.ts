import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { environment } from '@env/environment';

type VStatus = 'available' | 'inuse' | 'maintenance' | 'retired';
interface Vehicle { id: string; name: string; plate: string; type: string; status: VStatus; assignedTo?: string | null; fuelType: string; odometerKm: number; acquiredAt: string; nextServiceAt?: string | null; notes?: string; }
interface Summary { total: number; available: number; inUse: number; maintenance: number; serviceDue: number; byType: { type: string; count: number }[]; }

@Component({
  selector: 'app-hr-fleet',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, DatePickerModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Human Resources" title="Fleet" subtitle="Company vehicles — assignments, status and service schedule.">
      <button pButton severity="secondary" outlined icon="pi pi-plus" label="Add vehicle" (click)="openCreate()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-4">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5">
          <div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div>
          <div class="text-[24px] leading-tight font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">{{ s.caption }}</div>
        </div>
      }
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      @for (v of vehicles(); track v.id) {
        <div class="card p-4">
          <div class="flex items-start gap-3">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-surface-100 dark:bg-surface-800 text-surface-500 shrink-0"><i class="pi {{ typeIcon(v.type) }}"></i></span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-surface-800 dark:text-surface-100 truncate">{{ v.name }}</div>
              <div class="text-[11px] text-surface-400 font-mono">{{ v.plate }} · {{ v.type }} · {{ v.fuelType }}</div>
            </div>
            <span class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" [class]="tone(v.status)">{{ label(v.status) }}</span>
          </div>

          <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mt-3">
            <div><dt class="text-surface-400">Driver</dt><dd class="font-medium">{{ v.assignedTo || '—' }}</dd></div>
            <div><dt class="text-surface-400">Odometer</dt><dd class="font-medium tabular-nums">{{ v.odometerKm | number }} km</dd></div>
            <div><dt class="text-surface-400">Next service</dt><dd class="font-medium" [class.text-rose-500]="serviceDue(v)">{{ v.nextServiceAt ? (v.nextServiceAt | date: 'mediumDate') : '—' }}</dd></div>
            <div><dt class="text-surface-400">Acquired</dt><dd class="font-medium">{{ v.acquiredAt | date: 'MMM y' }}</dd></div>
          </dl>

          @if (v.status !== 'retired') {
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-surface-100 dark:border-surface-800">
              <button pButton size="small" text class="!text-[11px] !py-0" icon="pi pi-user" [label]="v.assignedTo ? 'Reassign' : 'Assign'" (click)="openAssign(v)"></button>
              <button pButton size="small" text class="!text-[11px] !py-0" icon="pi pi-wrench" label="Service" (click)="openService(v)"></button>
              <p-select [options]="statusOptions" [ngModel]="v.status" (ngModelChange)="setStatus(v, $event)" optionLabel="label" optionValue="value" styleClass="ml-auto !text-xs" appendTo="body" />
            </div>
          }
        </div>
      }
      @if (!vehicles().length) { <div class="text-sm text-surface-400 py-10 text-center col-span-full">No vehicles yet.</div> }
    </div>

    <!-- Assign -->
    <p-dialog [(visible)]="assignVisible" [modal]="true" [style]="{ width: '26rem' }" header="Assign vehicle" [draggable]="false" [dismissableMask]="true">
      <div class="pt-1">
        <label class="text-xs font-medium text-surface-600">Driver</label>
        <input pInputText [(ngModel)]="assignDriver" class="w-full mt-1 !rounded-lg" placeholder="Leave blank to unassign" />
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="assignVisible = false"></button>
        <button pButton label="Save" (click)="saveAssign()"></button>
      </ng-template>
    </p-dialog>

    <!-- Service -->
    <p-dialog [(visible)]="serviceVisible" [modal]="true" [style]="{ width: '26rem' }" header="Log service" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3 pt-1">
        <div><label class="text-xs font-medium text-surface-600">Odometer (km)</label><p-inputNumber [(ngModel)]="svcOdo" [min]="0" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
        <div><label class="text-xs font-medium text-surface-600">Next service</label><p-datePicker [(ngModel)]="svcNext" dateFormat="d M yy" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" appendTo="body" [showIcon]="true" /></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="serviceVisible = false"></button>
        <button pButton label="Save" (click)="saveService()"></button>
      </ng-template>
    </p-dialog>

    <!-- Add vehicle -->
    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '32rem' }" header="Add vehicle" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-4 pt-2">
        <div><label class="text-xs font-medium text-surface-600">Model</label><input pInputText [(ngModel)]="form.name" class="w-full mt-1 !rounded-lg" placeholder="e.g. Toyota Innova" /></div>
        <div><label class="text-xs font-medium text-surface-600">Plate</label><input pInputText [(ngModel)]="form.plate" class="w-full mt-1 !rounded-lg" placeholder="KA01AB1234" /></div>
        <div><label class="text-xs font-medium text-surface-600">Type</label><p-select [options]="typeOptions" [(ngModel)]="form.type" styleClass="w-full mt-1 !rounded-lg" appendTo="body" /></div>
        <div><label class="text-xs font-medium text-surface-600">Fuel</label><p-select [options]="fuelOptions" [(ngModel)]="form.fuelType" styleClass="w-full mt-1 !rounded-lg" appendTo="body" /></div>
        <div><label class="text-xs font-medium text-surface-600">Odometer (km)</label><p-inputNumber [(ngModel)]="form.odometerKm" [min]="0" styleClass="w-full mt-1" inputStyleClass="!rounded-lg w-full" /></div>
        <div><label class="text-xs font-medium text-surface-600">Driver (optional)</label><input pInputText [(ngModel)]="form.assignedTo" class="w-full mt-1 !rounded-lg" /></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Add vehicle" [disabled]="!form.name.trim() || !form.plate.trim()" (click)="submitCreate()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class FleetComponent {
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly base = `${environment.apiBaseUrl}/my-work/fleet`;

  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly typeOptions = ['Car', 'Van', 'Truck', 'Bike', 'Bus'];
  protected readonly fuelOptions = ['Petrol', 'Diesel', 'CNG', 'Electric'];
  protected readonly statusOptions = [
    { label: 'Available', value: 'available' }, { label: 'In use', value: 'inuse' }, { label: 'Maintenance', value: 'maintenance' }, { label: 'Retired', value: 'retired' }
  ];

  createVisible = false;
  form = this.blank();
  assignVisible = false; assignDriver = ''; private target: Vehicle | null = null;
  serviceVisible = false; svcOdo = 0; svcNext: Date | null = null;

  constructor() { this.reload(); }
  reload() {
    forkJoin({ list: this.http.get<Vehicle[]>(this.base), summary: this.http.get<Summary>(`${this.base}/summary`) })
      .subscribe((r) => { this.vehicles.set(r.list); this.summary.set(r.summary); });
  }

  protected readonly stats = computed(() => {
    const s = this.summary();
    return [
      { label: 'Vehicles', value: s?.total ?? 0, caption: 'in fleet', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Available', value: s?.available ?? 0, caption: 'ready to assign', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'In use', value: s?.inUse ?? 0, caption: 'on the road', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Service due', value: s?.serviceDue ?? 0, caption: 'within 2 weeks', tone: (s?.serviceDue ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100' }
    ];
  });

  openAssign(v: Vehicle) { this.target = v; this.assignDriver = v.assignedTo ?? ''; this.assignVisible = true; }
  saveAssign() { if (!this.target) return; this.http.post(`${this.base}/${this.target.id}/assign`, { assignedTo: this.assignDriver.trim() || null }).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Assignment updated' }); this.assignVisible = false; this.reload(); }); }
  openService(v: Vehicle) { this.target = v; this.svcOdo = v.odometerKm; this.svcNext = v.nextServiceAt ? new Date(v.nextServiceAt) : null; this.serviceVisible = true; }
  saveService() { if (!this.target) return; this.http.post(`${this.base}/${this.target.id}/service`, { odometerKm: this.svcOdo, nextServiceAt: this.svcNext ? this.iso(this.svcNext) : null }).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Service logged' }); this.serviceVisible = false; this.reload(); }); }
  setStatus(v: Vehicle, status: VStatus) { if (status === v.status) return; this.http.post(`${this.base}/${v.id}/status`, { status }).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Status updated', detail: `${v.name} → ${this.label(status)}` }); this.reload(); }); }
  openCreate() { this.form = this.blank(); this.createVisible = true; }
  submitCreate() { this.http.post(this.base, { ...this.form }).subscribe({ next: () => { this.messages.add({ severity: 'success', summary: 'Vehicle added' }); this.createVisible = false; this.reload(); }, error: (e) => this.messages.add({ severity: 'error', summary: 'Failed', detail: e?.error?.message }) }); }

  serviceDue(v: Vehicle): boolean { return !!v.nextServiceAt && v.status !== 'retired' && new Date(v.nextServiceAt) <= new Date(Date.now() + 14 * 864e5); }
  typeIcon(t: string): string { return ({ Car: 'pi-car', Van: 'pi-truck', Truck: 'pi-truck', Bike: 'pi-bookmark', Bus: 'pi-truck' } as Record<string, string>)[t] ?? 'pi-car'; }
  label(s: string): string { return ({ available: 'Available', inuse: 'In use', maintenance: 'Maintenance', retired: 'Retired' } as Record<string, string>)[s] ?? s; }
  tone(s: string): string { return ({ available: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', inuse: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300', maintenance: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', retired: 'bg-surface-100 text-surface-400 dark:bg-surface-800' } as Record<string, string>)[s] ?? ''; }
  private iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  private blank() { return { name: '', plate: '', type: 'Car', fuelType: 'Petrol', odometerKm: 0, assignedTo: '' }; }
}
