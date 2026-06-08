import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CrmSummary, Opportunity, Product, Quotation, QuotationStatus, SalesStage, SalesSummary } from './models';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/sales`;

  // ── CRM · opportunities ──
  opportunities(filter?: { stage?: SalesStage | null; search?: string | null }): Observable<Opportunity[]> {
    let params = new HttpParams();
    if (filter?.stage) params = params.set('stage', filter.stage);
    if (filter?.search) params = params.set('search', filter.search);
    return this.http.get<Opportunity[]>(`${this.base}/opportunities`, { params });
  }
  crmSummary(): Observable<CrmSummary> {
    return this.http.get<CrmSummary>(`${this.base}/crm-summary`);
  }
  createOpportunity(body: Partial<Opportunity> & { name: string; customer: string }): Observable<Opportunity> {
    return this.http.post<Opportunity>(`${this.base}/opportunities`, body);
  }
  updateOpportunity(id: string, body: Partial<Opportunity>): Observable<Opportunity> {
    return this.http.put<Opportunity>(`${this.base}/opportunities/${id}`, body);
  }
  moveStage(id: string, stage: SalesStage, note?: string | null): Observable<Opportunity> {
    return this.http.post<Opportunity>(`${this.base}/opportunities/${id}/stage`, { stage, note: note ?? null });
  }
  addActivity(id: string, body: { kind: string; summary: string; dueDate?: string | null }): Observable<Opportunity> {
    return this.http.post<Opportunity>(`${this.base}/opportunities/${id}/activity`, body);
  }
  completeActivity(id: string, index: number): Observable<Opportunity> {
    return this.http.post<Opportunity>(`${this.base}/opportunities/${id}/activity/${index}/done`, {});
  }

  // ── Products ──
  products(search?: string | null): Observable<Product[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Product[]>(`${this.base}/products`, { params });
  }
  createProduct(body: Partial<Product> & { name: string }): Observable<Product> {
    return this.http.post<Product>(`${this.base}/products`, body);
  }
  updateProduct(id: string, body: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.base}/products/${id}`, body);
  }

  // ── Quotations / sales orders ──
  quotations(filter?: { status?: QuotationStatus | null; search?: string | null }): Observable<Quotation[]> {
    let params = new HttpParams();
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.search) params = params.set('search', filter.search);
    return this.http.get<Quotation[]>(`${this.base}/quotations`, { params });
  }
  quotation(id: string): Observable<Quotation> {
    return this.http.get<Quotation>(`${this.base}/quotations/${id}`);
  }
  createQuotation(body: Partial<Quotation> & { customer: string }): Observable<Quotation> {
    return this.http.post<Quotation>(`${this.base}/quotations`, body);
  }
  updateQuotation(id: string, body: Partial<Quotation>): Observable<Quotation> {
    return this.http.put<Quotation>(`${this.base}/quotations/${id}`, body);
  }
  sendQuotation(id: string): Observable<Quotation> { return this.http.post<Quotation>(`${this.base}/quotations/${id}/send`, {}); }
  confirmQuotation(id: string): Observable<Quotation> { return this.http.post<Quotation>(`${this.base}/quotations/${id}/confirm`, {}); }
  cancelQuotation(id: string): Observable<Quotation> { return this.http.post<Quotation>(`${this.base}/quotations/${id}/cancel`, {}); }
  draftQuotation(id: string): Observable<Quotation> { return this.http.post<Quotation>(`${this.base}/quotations/${id}/draft`, {}); }

  summary(): Observable<SalesSummary> {
    return this.http.get<SalesSummary>(`${this.base}/summary`);
  }
}
