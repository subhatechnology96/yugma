import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { FinanceService } from '../finance.service';
import { FinanceFile } from '../models';

@Component({
  selector: 'app-finance-documents',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, DialogModule, SelectModule, InputTextModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Finance" [title]="signMode() ? 'Sign' : 'Documents'" [subtitle]="signMode() ? 'Documents routed for e-signature — request and capture signatures.' : 'Your finance document library — invoices, contracts, statements and reports.'">
      @if (!signMode()) { <button pButton severity="secondary" outlined icon="pi pi-upload" label="Add document" (click)="createVisible = true"></button> }
    </app-page-header>

    <div class="card overflow-hidden">
      <p-table [value]="files()" responsiveLayout="scroll" [rowHover]="true" [paginator]="files().length > 15" [rows]="15" class="p-1">
        <ng-template pTemplate="header">
          <tr class="!bg-surface-50 dark:!bg-surface-900/40">
            <th class="!text-xs !uppercase !text-surface-500">Name</th>
            <th class="!text-xs !uppercase !text-surface-500">Category</th>
            <th class="!text-xs !uppercase !text-surface-500">Owner</th>
            <th class="!text-xs !uppercase !text-surface-500">Added</th>
            <th class="!text-xs !uppercase !text-surface-500">Signature</th>
            <th class="!w-44"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-f>
          <tr>
            <td class="text-sm font-medium flex items-center gap-2"><i class="pi pi-file-pdf text-rose-400/80"></i>{{ f.name }}</td>
            <td class="text-sm">{{ f.category }}</td>
            <td class="text-sm text-surface-500">{{ f.owner }}</td>
            <td class="text-sm text-surface-500">{{ f.createdAt | date: 'mediumDate' }}</td>
            <td>
              @if (f.signatureStatus === 'signed') { <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">Signed</span> }
              @else if (f.signatureStatus === 'pending') { <span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">Pending{{ f.signer ? ' · ' + f.signer : '' }}</span> }
              @else { <span class="text-[11px] text-surface-400">—</span> }
            </td>
            <td (click)="$event.stopPropagation()" class="text-right whitespace-nowrap">
              @if (f.signatureStatus === 'pending') {
                <button pButton size="small" outlined class="!text-[11px] !py-0.5" icon="pi pi-check" label="Mark signed" (click)="sign(f)"></button>
              } @else if (f.signatureStatus === 'none') {
                <button pButton size="small" text class="!text-[11px] !py-0" icon="pi pi-pencil" label="Request signature" (click)="openRequest(f)"></button>
              } @else {
                <span class="text-[11px] text-surface-400">{{ f.signedAt | date: 'mediumDate' }}</span>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage"><tr><td colspan="6" class="py-10 text-center text-surface-500">{{ signMode() ? 'Nothing awaiting signature.' : 'No documents.' }}</td></tr></ng-template>
      </p-table>
    </div>

    <!-- Add document -->
    <p-dialog [(visible)]="createVisible" [modal]="true" [style]="{ width: '30rem' }" header="Add document" [draggable]="false" [dismissableMask]="true">
      <div class="space-y-3 pt-1">
        <div>
          <label class="text-xs font-medium text-surface-600">File name</label>
          <input pInputText [(ngModel)]="newName" class="w-full mt-1 !rounded-lg" placeholder="e.g. Contract — Acme.pdf" />
        </div>
        <div>
          <label class="text-xs font-medium text-surface-600">Category</label>
          <p-select [options]="categories" [(ngModel)]="newCategory" styleClass="w-full mt-1 !rounded-lg" appendTo="body" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="createVisible = false"></button>
        <button pButton label="Add" [disabled]="!newName.trim()" (click)="create()"></button>
      </ng-template>
    </p-dialog>

    <!-- Request signature -->
    <p-dialog [(visible)]="requestVisible" [modal]="true" [style]="{ width: '28rem' }" header="Request signature" [draggable]="false" [dismissableMask]="true">
      <div class="pt-1">
        <label class="text-xs font-medium text-surface-600">Signer</label>
        <input pInputText [(ngModel)]="signer" class="w-full mt-1 !rounded-lg" placeholder="Who needs to sign?" />
      </div>
      <ng-template pTemplate="footer">
        <button pButton severity="secondary" outlined label="Cancel" (click)="requestVisible = false"></button>
        <button pButton label="Send request" [disabled]="!signer.trim()" (click)="request()"></button>
      </ng-template>
    </p-dialog>
  `
})
export class DocumentsComponent {
  private readonly svc = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);

  protected readonly signMode = signal<boolean>(false);
  protected readonly files = signal<FinanceFile[]>([]);
  protected readonly categories = ['Invoice', 'Contract', 'Statement', 'Report', 'Tax', 'Document'];

  createVisible = false;
  newName = '';
  newCategory = 'Document';
  requestVisible = false;
  signer = '';
  private target: FinanceFile | null = null;

  constructor() {
    this.route.data.subscribe((d) => { this.signMode.set(!!d['sign']); this.reload(); });
  }
  reload() { this.svc.files(this.signMode() ? 'sign' : null).subscribe((f) => this.files.set(f)); }

  openRequest(f: FinanceFile) { this.target = f; this.signer = ''; this.requestVisible = true; }
  request() {
    if (!this.target) return;
    this.svc.requestSignature(this.target.id, this.signer.trim()).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Signature requested' }); this.requestVisible = false; this.reload(); });
  }
  sign(f: FinanceFile) {
    this.svc.sign(f.id).subscribe(() => { this.messages.add({ severity: 'success', summary: 'Marked signed', detail: f.name }); this.reload(); });
  }
  create() {
    if (!this.newName.trim()) return;
    this.svc.createFile(this.newName.trim(), this.newCategory).subscribe(() => {
      this.messages.add({ severity: 'success', summary: 'Document added' });
      this.createVisible = false; this.newName = ''; this.newCategory = 'Document'; this.reload();
    });
  }
}
