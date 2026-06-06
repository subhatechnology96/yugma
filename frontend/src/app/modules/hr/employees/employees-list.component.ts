import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { HrAgentRailComponent } from '../agents/hr-agent-rail.component';
import { EmployeeService } from '../services/employee.service';
import { Employee, EmployeeStatus } from '../models/hr.models';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-employees-list',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    TagModule,
    TooltipModule,
    MenuModule,
    PageHeaderComponent,
    StatusPillComponent,
    AvatarComponent,
    KpiCardComponent,
    HrAgentRailComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employees-list.component.html'
})
export class EmployeesListComponent implements OnInit {
  private readonly svc = inject(EmployeeService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly loading = signal(false);
  protected readonly rows = signal<Employee[]>([]);
  protected readonly total = signal(0);
  protected page = 1;
  protected pageSize = 10;

  /** Access scope for the current user: HR/admins manage the directory; team leads see their team; others see their own row. */
  protected readonly canAdd = signal(false);
  protected readonly scope = signal<'all' | 'team' | 'self'>('all');

  protected query = '';
  protected departmentFilter: string | null = null;
  protected statusFilter: EmployeeStatus | null = null;
  protected sortBy = 'fullName';
  protected sortDir: 'asc' | 'desc' = 'asc';

  /** Which KPI card is currently driving the table view. */
  protected readonly activeKpi = signal<'all' | 'active' | 'on-leave' | 'ctc'>('all');

  protected readonly departments = computed(() => [
    { label: 'All departments', value: null },
    ...this.svc.departments().map((d) => ({ label: d, value: d }))
  ]);
  protected readonly statuses = [
    { label: 'All statuses', value: null },
    { label: 'Active', value: 'active' },
    { label: 'On leave', value: 'on-leave' },
    { label: 'Inactive', value: 'inactive' }
  ];

  protected readonly kpis = computed(() => {
    const all = this.svc.all();
    return {
      headcount: all.length,
      active: all.filter((e) => e.status === 'active').length,
      onLeave: all.filter((e) => e.status === 'on-leave').length,
      avgCtc: Math.round((all.reduce((s, e) => s + e.ctcLakhs, 0) / Math.max(all.length, 1)) * 10) / 10
    };
  });

  ngOnInit() {
    this.svc.access().subscribe((a) => {
      this.canAdd.set(a.canAddEmployee);
      this.scope.set(a.scope);
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc
      .list({
        page: this.page,
        pageSize: this.pageSize,
        search: this.query,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        filters: { department: this.departmentFilter, status: this.statusFilter }
      })
      .subscribe((r) => {
        // department/status are filtered server-side, so totals/paging stay accurate.
        this.rows.set(r.items);
        this.total.set(r.total);
        this.loading.set(false);
      });
  }

  onLazyLoad(e: TableLazyLoadEvent) {
    const first = e.first ?? 0;
    const rows = e.rows ?? this.pageSize;
    this.pageSize = rows;
    this.page = Math.floor(first / rows) + 1;
    this.load();
  }

  onSearch() {
    this.page = 1;
    this.load();
  }

  /** Click handler for the KPI cards — each card drives a table view. */
  selectKpi(kpi: 'all' | 'active' | 'on-leave' | 'ctc') {
    // Clicking the already-active card resets to the default "all" view.
    const next = this.activeKpi() === kpi ? 'all' : kpi;
    this.activeKpi.set(next);
    this.page = 1;

    if (next === 'ctc') {
      // Keep any status filter; just sort by highest compensation.
      this.sortBy = 'ctcLakhs';
      this.sortDir = 'desc';
    } else {
      this.sortBy = 'fullName';
      this.sortDir = 'asc';
      this.statusFilter = next === 'all' ? null : (next as EmployeeStatus);
    }
    this.load();
  }

  /** Keep the KPI highlight in sync when the status dropdown is used. */
  onStatusFilterChange() {
    this.activeKpi.set(
      this.statusFilter === 'active'
        ? 'active'
        : this.statusFilter === 'on-leave'
          ? 'on-leave'
          : 'all'
    );
    this.page = 1;
    this.load();
  }

  /** Export the full employee directory as a CSV download. */
  export() {
    const employees = this.svc.all();
    if (!employees.length) {
      this.messages.add({ severity: 'info', summary: 'Nothing to export', detail: 'No employees loaded yet.' });
      return;
    }
    const headers = ['Code', 'Full name', 'Email', 'Phone', 'Department', 'Designation', 'Location', 'Joined', 'CTC (₹L)', 'Status'];
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = employees.map((e) =>
      [e.code, e.fullName, e.email, e.phone, e.department, e.designation, e.location, e.joinedAt, e.ctcLakhs, this.statusLabel(e.status)]
        .map(cell)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.messages.add({ severity: 'success', summary: 'Export ready', detail: `${employees.length} employees exported to CSV.` });
  }

  rowMenu(emp: Employee): MenuItem[] {
    return [
      { label: 'View profile', icon: 'pi pi-user', command: () => this.router.navigate(['/my-work/employees', emp.id]) },
      { label: 'Edit', icon: 'pi pi-pencil', command: () => this.router.navigate(['/my-work/employees', emp.id], { queryParams: { edit: 1 } }) },
      { label: 'Send message', icon: 'pi pi-envelope' },
      { separator: true },
      {
        label: 'Deactivate',
        icon: 'pi pi-ban',
        styleClass: '!text-rose-600',
        command: () => this.confirmDeactivate(emp)
      }
    ];
  }

  private confirmDeactivate(emp: Employee) {
    this.confirm.confirm({
      header: 'Deactivate employee?',
      message: `${emp.fullName} will lose access immediately. This can be reversed by HR admins.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Deactivate',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.update(emp.id, { status: 'inactive' }).subscribe(() => {
          this.messages.add({ severity: 'success', summary: 'Deactivated', detail: emp.fullName });
          this.load();
        });
      }
    });
  }

  statusTone(s: EmployeeStatus): 'success' | 'warn' | 'neutral' {
    return s === 'active' ? 'success' : s === 'on-leave' ? 'warn' : 'neutral';
  }
  statusLabel(s: EmployeeStatus): string {
    return s === 'on-leave' ? 'On leave' : s.charAt(0).toUpperCase() + s.slice(1);
  }
}
