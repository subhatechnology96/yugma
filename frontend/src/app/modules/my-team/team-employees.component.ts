import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusPillComponent } from '@shared/components/status-pill/status-pill.component';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { EmployeeService } from '../hr/services/employee.service';
import { Employee, EmployeeStatus } from '../hr/models/hr.models';

/**
 * "My Team · Employees" — a manager's scoped view of just the people who report to them
 * (directly or transitively). Backed by GET /api/hr/employees/team, which excludes the
 * manager's own record. Rows link to the shared employee profile at /hr/employees/:id.
 */
@Component({
  selector: 'app-team-employees',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    PageHeaderComponent,
    StatusPillComponent,
    AvatarComponent,
    KpiCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-employees.component.html'
})
export class TeamEmployeesComponent implements OnInit {
  private readonly svc = inject(EmployeeService);

  protected readonly loading = signal(false);
  protected readonly rows = signal<Employee[]>([]);
  protected readonly total = signal(0);
  protected page = 1;
  protected pageSize = 10;

  protected query = '';
  protected sortBy = 'fullName';
  protected sortDir: 'asc' | 'desc' = 'asc';

  protected readonly kpis = computed(() => {
    const team = this.rows();
    return {
      size: this.total(),
      active: team.filter((e) => e.status === 'active').length,
      onLeave: team.filter((e) => e.status === 'on-leave').length
    };
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc
      .team({
        page: this.page,
        pageSize: this.pageSize,
        search: this.query,
        sortBy: this.sortBy,
        sortDir: this.sortDir
      })
      .subscribe((r) => {
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

  statusTone(s: EmployeeStatus): 'success' | 'warn' | 'neutral' {
    return s === 'active' ? 'success' : s === 'on-leave' ? 'warn' : 'neutral';
  }
  statusLabel(s: EmployeeStatus): string {
    return s === 'on-leave' ? 'On leave' : s.charAt(0).toUpperCase() + s.slice(1);
  }
}
