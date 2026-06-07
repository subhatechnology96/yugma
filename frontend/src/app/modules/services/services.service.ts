import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { ServiceOrder, ServiceSummary, ServiceStage, ServiceType, TimesheetReport } from './models';

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/services`;

  orders(filter?: { type?: ServiceType | null; stage?: ServiceStage | null; search?: string | null }): Observable<ServiceOrder[]> {
    let params = new HttpParams();
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.stage) params = params.set('stage', filter.stage);
    if (filter?.search) params = params.set('search', filter.search);
    return this.http.get<ServiceOrder[]>(`${this.base}/orders`, { params });
  }

  order(id: string): Observable<ServiceOrder> {
    return this.http.get<ServiceOrder>(`${this.base}/orders/${id}`);
  }

  summary(): Observable<ServiceSummary> {
    return this.http.get<ServiceSummary>(`${this.base}/summary`);
  }

  create(body: Partial<ServiceOrder> & { title: string; customer: string }): Observable<ServiceOrder> {
    return this.http.post<ServiceOrder>(`${this.base}/orders`, body);
  }

  update(id: string, body: Partial<ServiceOrder>): Observable<ServiceOrder> {
    return this.http.put<ServiceOrder>(`${this.base}/orders/${id}`, body);
  }

  move(id: string, stage: ServiceStage, note?: string | null): Observable<ServiceOrder> {
    return this.http.post<ServiceOrder>(`${this.base}/orders/${id}/stage`, { stage, note: note ?? null });
  }

  assign(id: string, body: { assignedTo: string | null; scheduledAt: string | null; note?: string | null }): Observable<ServiceOrder> {
    return this.http.post<ServiceOrder>(`${this.base}/orders/${id}/assign`, body);
  }

  logTime(id: string, body: { person: string; hours: number; date: string | null; note?: string | null }): Observable<ServiceOrder> {
    return this.http.post<ServiceOrder>(`${this.base}/orders/${id}/timesheet`, body);
  }

  timesheets(person?: string | null): Observable<TimesheetReport> {
    let params = new HttpParams();
    if (person) params = params.set('person', person);
    return this.http.get<TimesheetReport>(`${this.base}/timesheets`, { params });
  }

  planning(): Observable<ServiceOrder[]> {
    return this.http.get<ServiceOrder[]>(`${this.base}/planning`);
  }
}
