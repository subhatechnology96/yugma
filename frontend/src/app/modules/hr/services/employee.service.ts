import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import { Employee } from '../models/hr.models';
import { PageRequest, PageResult } from '@core/models/common.models';

interface ApiPaged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr/employees`;

  // Full directory snapshot — drives KPIs, charts and pickers, independent of the
  // employee table's current page/filter. 200 is the API's max page size.
  private readonly _directory = signal<Employee[]>([]);
  readonly all = this._directory.asReadonly();

  constructor() {
    this.refresh();
  }

  /** (Re)loads the complete employee directory used by KPIs/dashboards. */
  refresh(): void {
    this.list({ page: 1, pageSize: 200, sortBy: 'fullName', sortDir: 'asc' }).subscribe((res) =>
      this._directory.set(res.items)
    );
  }

  list(req: PageRequest): Observable<PageResult<Employee>> {
    let params = new HttpParams()
      .set('page', String(req.page ?? 1))
      .set('pageSize', String(req.pageSize ?? 20));
    if (req.search) params = params.set('search', req.search);
    if (req.sortBy) params = params.set('sortBy', req.sortBy);
    if (req.sortDir) params = params.set('sortDir', req.sortDir);

    const department = req.filters?.['department'];
    const status = req.filters?.['status'];
    if (department) params = params.set('department', String(department));
    if (status) params = params.set('status', String(status));

    // Note: paged/filtered table reads must NOT mutate the directory snapshot,
    // otherwise the KPI totals would shrink to the current page.
    return this.http.get<ApiPaged<Employee>>(this.base, { params });
  }

  byId(id: string): Observable<Employee | undefined> {
    return this.http.get<Employee>(`${this.base}/${id}`);
  }

  create(input: Omit<Employee, 'id' | 'code'>): Observable<Employee> {
    // Backend's CreateEmployeeCommand expects the .NET enum spelling (FullTime, PartTime, …)
    // and only the fields below. Drop client-only fields (status, performance).
    const employmentType = (input.employmentType ?? 'Full-time').replace('-', '');
    const payload = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      department: input.department,
      designation: input.designation,
      location: input.location || 'Bengaluru',
      employmentType,
      joinedAt: input.joinedAt,
      ctcLakhs: input.ctcLakhs ?? 0,
      manager: input.manager ?? null,
      skills: input.skills ?? [],
      avatarUrl: input.avatarUrl ?? null
    };
    return this.http.post<Employee>(this.base, payload).pipe(
      tap((emp) => this._directory.update((list) => [emp, ...list]))
    );
  }

  update(id: string, patch: Partial<Employee>): Observable<Employee | undefined> {
    return this.http.put<Employee>(`${this.base}/${id}`, patch).pipe(
      // Keep the directory snapshot (and therefore the KPI counts) in sync after edits.
      tap(() => this.refresh())
    );
  }

  remove(id: string): Observable<boolean> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(tap()) as unknown as Observable<boolean>;
  }

  departments = computed(() =>
    Array.from(new Set(this._directory().map((e) => e.department))).sort()
  );
  locations = computed(() =>
    Array.from(new Set(this._directory().map((e) => e.location))).sort()
  );
}
