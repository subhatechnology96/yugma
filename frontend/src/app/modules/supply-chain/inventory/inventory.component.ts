import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SupplyChainService } from '../supply-chain.service';
import { MOVE_STATUS_META, MOVE_TYPE_META, StockItem, StockMove, StockMoveStatus, StockMoveType, SupplyChainSummary } from '../models';

@Component({
  selector: 'app-sc-inventory',
  standalone: true,
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, TableModule, TabsModule, SelectModule, InputTextModule, InputNumberModule, TooltipModule, PageHeaderComponent, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Supply Chain" title="Inventory" subtitle="Real-time stock on hand across warehouse locations, with receipts, deliveries and internal transfers.">
      <button pButton icon="pi pi-plus" label="New product" severity="secondary" outlined (click)="openItem()"></button>
      <button pButton icon="pi pi-arrows-h" label="New transfer" (click)="openMove()"></button>
    </app-page-header>

    <div class="grid grid-cols-2 lg:grid-cols-5 gap-px bg-surface-200 dark:bg-surface-800 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 mb-5">
      @for (s of stats(); track s.label) {
        <div class="bg-white dark:bg-surface-900 px-4 py-3.5"><div class="text-[11px] uppercase tracking-wide text-surface-400">{{ s.label }}</div><div class="text-[22px] font-semibold mt-0.5 tabular-nums" [class]="s.tone">{{ s.value }}</div><div class="text-[11px] text-surface-400">{{ s.caption }}</div></div>
      }
    </div>

    <p-tabs value="stock">
      <p-tablist>
        <p-tab value="stock">Stock on hand</p-tab>
        <p-tab value="moves">Transfers</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="stock">
          <div class="flex flex-wrap items-center gap-1.5 mb-3">
            <input pInputText [(ngModel)]="itemSearch" (ngModelChange)="loadItems()" placeholder="Search products…" class="!h-9 !text-sm w-56" />
            <button class="chip" [class.chip-on]="itemCat() === 'All'" (click)="setCat('All')">All</button>
            @for (c of categories(); track c) { <button class="chip" [class.chip-on]="itemCat() === c" (click)="setCat(c)">{{ c }}</button> }
          </div>
          <div class="card p-0 overflow-hidden">
            <p-table [value]="items()" [rowHover]="true" [paginator]="items().length > 15" [rows]="15" responsiveLayout="scroll">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-[11px] !uppercase !text-surface-500">Product</th>
                  <th class="!text-[11px] !uppercase !text-surface-500">Location</th>
                  <th class="!text-[11px] !uppercase !text-surface-500 !text-right">On hand</th>
                  <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Forecast</th>
                  <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Reorder</th>
                  <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Value</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-i>
                <tr class="cursor-pointer" (click)="openItem(i)">
                  <td><div class="text-sm font-medium">{{ i.name }}</div><div class="text-[11px] text-surface-400">[{{ i.sku }}] · {{ i.category }}</div></td>
                  <td class="text-sm text-surface-500">{{ i.location }}</td>
                  <td class="text-right tabular-nums text-sm" [class]="i.belowReorder ? 'text-rose-500 font-semibold' : ''">{{ i.onHand }} <span class="text-[11px] text-surface-400">{{ i.uom }}</span></td>
                  <td class="text-right tabular-nums text-sm text-surface-500">{{ i.forecast }}</td>
                  <td class="text-right tabular-nums text-sm text-surface-400">{{ i.reorderPoint }}</td>
                  <td class="text-right tabular-nums text-sm font-medium">{{ i.value | inr }}</td>
                  <td class="text-right">@if (i.belowReorder) { <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10">Reorder</span> }</td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage"><tr><td colspan="7" class="py-12 text-center text-surface-400 text-sm">No products.</td></tr></ng-template>
            </p-table>
          </div>
        </p-tabpanel>

        <p-tabpanel value="moves">
          <div class="flex flex-wrap items-center gap-1.5 mb-3">
            <button class="chip" [class.chip-on]="!moveType()" (click)="setMoveType(null)">All</button>
            @for (t of moveTypes; track t) { <button class="chip" [class.chip-on]="moveType() === t" (click)="setMoveType(t)">{{ moveTypeMeta[t].label }}</button> }
          </div>
          <div class="card p-0 overflow-hidden">
            <p-table [value]="moves()" [rowHover]="true" [paginator]="moves().length > 15" [rows]="15" responsiveLayout="scroll">
              <ng-template pTemplate="header">
                <tr class="!bg-surface-50 dark:!bg-surface-900/40">
                  <th class="!text-[11px] !uppercase !text-surface-500">Reference</th>
                  <th class="!text-[11px] !uppercase !text-surface-500">Type</th>
                  <th class="!text-[11px] !uppercase !text-surface-500">Product</th>
                  <th class="!text-[11px] !uppercase !text-surface-500 !text-right">Qty</th>
                  <th class="!text-[11px] !uppercase !text-surface-500">From → To</th>
                  <th class="!text-[11px] !uppercase !text-surface-500">Scheduled</th>
                  <th class="!text-[11px] !uppercase !text-surface-500">Status</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-m>
                <tr>
                  <td class="font-medium text-sm">{{ m.reference }}</td>
                  <td><span class="inline-flex items-center gap-1 text-xs text-surface-500"><i class="pi {{ typeMeta(m.moveType).icon }} text-[11px]"></i>{{ typeMeta(m.moveType).label }}</span></td>
                  <td class="text-sm">{{ m.product }}</td>
                  <td class="text-right tabular-nums text-sm">{{ m.quantity }}</td>
                  <td class="text-xs text-surface-500">{{ m.sourceLocation }} <i class="pi pi-arrow-right text-[9px] mx-0.5"></i> {{ m.destLocation }}</td>
                  <td class="text-sm text-surface-500">{{ m.scheduledDate | date: 'dd MMM' }}</td>
                  <td><app-status-pill [tone]="statusMeta(m.status).tone">{{ statusMeta(m.status).label }}</app-status-pill></td>
                  <td class="text-right whitespace-nowrap">
                    @if (m.status === 'Draft') { <button pButton size="small" text label="Mark ready" (click)="setMoveStatus(m, 'Ready')"></button> }
                    @if (m.status === 'Ready') { <button pButton size="small" text label="Validate" (click)="setMoveStatus(m, 'Done')"></button> }
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage"><tr><td colspan="8" class="py-12 text-center text-surface-400 text-sm">No transfers.</td></tr></ng-template>
            </p-table>
          </div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    <!-- product dialog -->
    <p-dialog [(visible)]="itemVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="editingItem() ? 'Edit product' : 'New product'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Name *</label><input pInputText [(ngModel)]="itemForm.name" class="w-full" /></div>
        <div><label class="lbl">SKU</label><input pInputText [(ngModel)]="itemForm.sku" class="w-full" placeholder="auto" [disabled]="!!editingItem()" /></div>
        <div><label class="lbl">Category</label><input pInputText [(ngModel)]="itemForm.category" class="w-full" /></div>
        <div><label class="lbl">Location</label><input pInputText [(ngModel)]="itemForm.location" class="w-full" /></div>
        <div><label class="lbl">Unit cost (₹)</label><p-inputNumber [(ngModel)]="itemForm.unitCost" [min]="0" mode="decimal" [minFractionDigits]="2" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">On hand</label><p-inputNumber [(ngModel)]="itemForm.onHand" mode="decimal" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Reserved</label><p-inputNumber [(ngModel)]="itemForm.reserved" [min]="0" mode="decimal" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Reorder point</label><p-inputNumber [(ngModel)]="itemForm.reorderPoint" [min]="0" mode="decimal" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Unit of measure</label><input pInputText [(ngModel)]="itemForm.uom" class="w-full" /></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="itemVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="saveItem()"></button>
      </ng-template>
    </p-dialog>

    <!-- transfer dialog -->
    <p-dialog [(visible)]="moveVisible" [modal]="true" [style]="{ width: '30rem' }" header="New transfer" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-3">
        <div><label class="lbl">Type</label><p-select [(ngModel)]="moveForm.moveType" [options]="moveTypeOptions" optionLabel="label" optionValue="value" class="w-full"></p-select></div>
        <div><label class="lbl">Product *</label><input pInputText [(ngModel)]="moveForm.product" class="w-full" /></div>
        <div><label class="lbl">Quantity</label><p-inputNumber [(ngModel)]="moveForm.quantity" [min]="0" mode="decimal" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Partner / Counterpart</label><input pInputText [(ngModel)]="moveForm.partner" class="w-full" placeholder="Vendor / Customer / Location" /></div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="moveVisible = false"></button>
        <button pButton label="Create" icon="pi pi-check" (click)="saveMove()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .lbl { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--p-surface-400); margin-bottom:3px; }
    .chip { padding:.25rem .7rem; border-radius:9999px; font-size:12px; border:1px solid var(--p-surface-200); color:var(--p-surface-500); transition:all .15s; }
    .chip-on { background:var(--p-surface-800); color:#fff; border-color:var(--p-surface-800); }
    :host-context(.app-dark) .chip-on { background:var(--p-surface-100); color:var(--p-surface-900); }
  `]
})
export class InventoryComponent {
  private readonly svc = inject(SupplyChainService);
  private readonly messages = inject(MessageService);
  protected readonly moveTypeMeta = MOVE_TYPE_META;
  protected typeMeta(t: string) { return MOVE_TYPE_META[t as StockMoveType]; }
  protected statusMeta(s: string) { return MOVE_STATUS_META[s as StockMoveStatus]; }
  protected readonly moveTypes: ('Receipt' | 'Delivery' | 'Internal')[] = ['Receipt', 'Delivery', 'Internal'];
  protected readonly moveTypeOptions = this.moveTypes.map((t) => ({ label: MOVE_TYPE_META[t].label, value: t }));

  protected itemSearch = '';
  protected readonly items = signal<StockItem[]>([]);
  protected readonly itemCat = signal('All');
  protected readonly categories = computed(() => [...new Set(this.items().map((i) => i.category))].sort());
  protected readonly moves = signal<StockMove[]>([]);
  protected readonly moveType = signal<string | null>(null);
  protected readonly summary = signal<SupplyChainSummary | null>(null);

  protected itemVisible = false;
  protected readonly editingItem = signal<StockItem | null>(null);
  protected itemForm = this.blankItem();
  protected moveVisible = false;
  protected moveForm = this.blankMove();

  constructor() { this.loadItems(); this.loadMoves(); this.svc.summary().subscribe((s) => this.summary.set(s)); }

  protected readonly stats = computed(() => {
    const s = this.summary(); const inr = new InrPipe();
    return [
      { label: 'Inventory value', value: inr.transform(s?.inventoryValue ?? 0, 'compact'), caption: 'on hand', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'SKUs', value: s?.skuCount ?? 0, caption: 'tracked', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Below reorder', value: s?.belowReorder ?? 0, caption: 'need restock', tone: (s?.belowReorder ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-surface-800 dark:text-surface-100' },
      { label: 'Incoming', value: s?.incomingMoves ?? 0, caption: 'receipts due', tone: 'text-surface-800 dark:text-surface-100' },
      { label: 'Outgoing', value: s?.outgoingMoves ?? 0, caption: 'deliveries due', tone: 'text-surface-800 dark:text-surface-100' }
    ];
  });

  loadItems() { this.svc.stockItems(this.itemSearch || null, this.itemCat() === 'All' ? null : this.itemCat()).subscribe((i) => this.items.set(i)); }
  loadMoves() { this.svc.stockMoves(this.moveType(), null).subscribe((m) => this.moves.set(m)); }
  setCat(c: string) { this.itemCat.set(c); this.loadItems(); }
  setMoveType(t: string | null) { this.moveType.set(t); this.loadMoves(); }

  openItem(i?: StockItem) {
    this.editingItem.set(i ?? null);
    this.itemForm = i ? { sku: i.sku, name: i.name, category: i.category, location: i.location, unitCost: i.unitCost, onHand: i.onHand, reserved: i.reserved, reorderPoint: i.reorderPoint, uom: i.uom } : this.blankItem();
    this.itemVisible = true;
  }
  saveItem() {
    if (!this.itemForm.name.trim()) { this.messages.add({ severity: 'warn', summary: 'Name is required' }); return; }
    const e = this.editingItem();
    const obs = e ? this.svc.updateStockItem(e.id, this.itemForm) : this.svc.createStockItem(this.itemForm);
    obs.subscribe(() => { this.itemVisible = false; this.loadItems(); this.svc.summary().subscribe((s) => this.summary.set(s)); this.messages.add({ severity: 'success', summary: e ? 'Saved' : 'Product created' }); });
  }

  openMove() { this.moveForm = this.blankMove(); this.moveVisible = true; }
  saveMove() {
    if (!this.moveForm.product.trim()) { this.messages.add({ severity: 'warn', summary: 'Product is required' }); return; }
    this.svc.createStockMove(this.moveForm).subscribe(() => { this.moveVisible = false; this.loadMoves(); this.messages.add({ severity: 'success', summary: 'Transfer created' }); });
  }
  setMoveStatus(m: StockMove, status: StockMoveStatus) {
    this.svc.moveStatus(m.id, status).subscribe(() => { this.loadMoves(); this.svc.summary().subscribe((s) => this.summary.set(s)); this.messages.add({ severity: 'success', summary: `Marked ${status}` }); });
  }

  private blankItem() { return { sku: '', name: '', category: 'Furniture', location: 'WH/Stock', unitCost: 0, onHand: 0, reserved: 0, reorderPoint: 0, uom: 'Units' }; }
  private blankMove() { return { moveType: 'Receipt' as StockMoveType, product: '', quantity: 1, partner: '' }; }
}
