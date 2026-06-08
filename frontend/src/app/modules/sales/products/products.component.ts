import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { InrPipe } from '@shared/components/inr.pipe';
import { SalesService } from '../sales.service';
import { Product } from '../models';

@Component({
  selector: 'app-sales-products',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, SelectModule, InputTextModule, InputNumberModule, TextareaModule, ToggleSwitchModule, PageHeaderComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Sales" title="Products" subtitle="Your sellable product & service catalog — used to build quotations.">
      <input pInputText [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search products…" class="!h-9 !text-sm w-52" />
      <button pButton icon="pi pi-plus" label="New" (click)="openNew()"></button>
    </app-page-header>

    <!-- category filter -->
    <div class="flex flex-wrap items-center gap-1.5 mb-4">
      <button class="chip" [class.chip-on]="category() === 'All'" (click)="setCategory('All')">All</button>
      @for (c of categories(); track c) { <button class="chip" [class.chip-on]="category() === c" (click)="setCategory(c)">{{ c }}</button> }
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      @for (p of filtered(); track p.id) {
        <div class="card p-4 hover:border-surface-300 dark:hover:border-surface-700 transition cursor-pointer flex flex-col" (click)="openEdit(p)">
          <div class="flex items-start justify-between gap-2">
            <span class="w-10 h-10 rounded-xl grid place-items-center bg-surface-100 dark:bg-surface-800 text-surface-400"><i class="pi pi-box"></i></span>
            @if (!p.active) { <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-400">Archived</span> }
          </div>
          <div class="text-sm font-medium text-surface-800 dark:text-surface-100 mt-3 leading-snug">{{ p.name }}</div>
          <div class="text-[11px] text-surface-400 mt-0.5">[{{ p.code }}] · {{ p.category }}</div>
          <div class="mt-auto pt-3 flex items-end justify-between">
            <div>
              <div class="text-lg font-semibold tabular-nums">{{ p.unitPrice | inr }}</div>
              <div class="text-[11px] text-surface-400">{{ p.taxPercent }}% tax</div>
            </div>
            <div class="text-right">
              <div class="text-sm tabular-nums" [class]="p.onHand < 0 ? 'text-rose-500' : 'text-surface-600 dark:text-surface-300'">{{ p.onHand }}</div>
              <div class="text-[11px] text-surface-400">{{ p.uom }}</div>
            </div>
          </div>
        </div>
      }
      @if (!filtered().length) { <div class="col-span-full text-center text-surface-400 text-sm py-12">No products.</div> }
    </div>

    <p-dialog [(visible)]="editorVisible" [modal]="true" [style]="{ width: '34rem' }" [header]="editing() ? 'Edit product' : 'New product'" [draggable]="false" [dismissableMask]="true">
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2"><label class="lbl">Name *</label><input pInputText [(ngModel)]="form.name" class="w-full" /></div>
        <div><label class="lbl">Code</label><input pInputText [(ngModel)]="form.code" class="w-full" placeholder="auto" [disabled]="!!editing()" /></div>
        <div><label class="lbl">Category</label><input pInputText [(ngModel)]="form.category" class="w-full" placeholder="Furniture" /></div>
        <div><label class="lbl">Unit price (₹)</label><p-inputNumber [(ngModel)]="form.unitPrice" [min]="0" mode="decimal" [minFractionDigits]="2" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Tax %</label><p-inputNumber [(ngModel)]="form.taxPercent" [min]="0" [max]="100" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">On hand</label><p-inputNumber [(ngModel)]="form.onHand" mode="decimal" class="w-full"></p-inputNumber></div>
        <div><label class="lbl">Unit of measure</label><input pInputText [(ngModel)]="form.uom" class="w-full" /></div>
        <div class="col-span-2"><label class="lbl">Description</label><textarea pTextarea [(ngModel)]="form.description" rows="2" class="w-full"></textarea></div>
        @if (editing()) { <div class="col-span-2 flex items-center gap-2"><p-toggleswitch [(ngModel)]="form.active"></p-toggleswitch><span class="text-sm">Active (sellable)</span></div> }
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="editorVisible = false"></button>
        <button pButton label="Save" icon="pi pi-check" (click)="save()"></button>
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
export class ProductsComponent {
  private readonly svc = inject(SalesService);
  private readonly messages = inject(MessageService);

  protected search = '';
  protected readonly all = signal<Product[]>([]);
  protected readonly category = signal('All');
  protected readonly categories = computed(() => [...new Set(this.all().map((p) => p.category))].sort());
  protected readonly filtered = computed(() => this.category() === 'All' ? this.all() : this.all().filter((p) => p.category === this.category()));

  protected editorVisible = false;
  protected readonly editing = signal<Product | null>(null);
  protected form = this.blank();

  constructor() { this.reload(); }
  private reload() { this.svc.products(this.search || null).subscribe((p) => this.all.set(p)); }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  onSearch() { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.reload(), 250); }
  setCategory(c: string) { this.category.set(c); }

  openNew() { this.editing.set(null); this.form = this.blank(); this.editorVisible = true; }
  openEdit(p: Product) {
    this.editing.set(p);
    this.form = { code: p.code, name: p.name, category: p.category, unitPrice: p.unitPrice, taxPercent: p.taxPercent, onHand: p.onHand, uom: p.uom, description: p.description ?? '', active: p.active };
    this.editorVisible = true;
  }
  save() {
    if (!this.form.name.trim()) { this.messages.add({ severity: 'warn', summary: 'Name is required' }); return; }
    const body = { ...this.form, name: this.form.name.trim() };
    const e = this.editing();
    const obs = e ? this.svc.updateProduct(e.id, body) : this.svc.createProduct(body as never);
    obs.subscribe(() => { this.editorVisible = false; this.reload(); this.messages.add({ severity: 'success', summary: e ? 'Product saved' : 'Product created' }); });
  }

  private blank() {
    return { code: '', name: '', category: 'Furniture', unitPrice: 0, taxPercent: 15, onHand: 0, uom: 'Units', description: '', active: true };
  }
}
