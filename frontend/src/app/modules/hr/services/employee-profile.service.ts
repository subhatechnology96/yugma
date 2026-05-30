import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AttendanceOverview,
  Career,
  EmployeeDocument,
  EmployeeOverview,
  LeaveOverview,
  PayrollOverview
} from '../models/employee-profile.models';

@Injectable({ providedIn: 'root' })
export class EmployeeProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr/employees`;

  overview(id: string): Observable<EmployeeOverview> {
    return this.http.get<EmployeeOverview>(`${this.base}/${id}/overview`);
  }

  attendance(id: string): Observable<AttendanceOverview> {
    return this.http.get<AttendanceOverview>(`${this.base}/${id}/attendance`);
  }

  leave(id: string): Observable<LeaveOverview> {
    return this.http.get<LeaveOverview>(`${this.base}/${id}/leave`);
  }

  payroll(id: string): Observable<PayrollOverview> {
    return this.http.get<PayrollOverview>(`${this.base}/${id}/payroll`);
  }

  documents(id: string): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.base}/${id}/documents`);
  }

  career(id: string): Observable<Career> {
    return this.http.get<Career>(`${this.base}/${id}/career`);
  }
  addProject(id: string, body: unknown): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/${id}/projects`, body);
  }
  updateProject(projectId: string, body: unknown): Observable<unknown> {
    return this.http.put(`${this.base}/projects/${projectId}`, body);
  }
  deleteProject(projectId: string): Observable<unknown> {
    return this.http.delete(`${this.base}/projects/${projectId}`);
  }
}
