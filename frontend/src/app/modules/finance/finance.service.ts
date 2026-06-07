import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { BankAccountDto, Expense, FinanceAnalytics, FinanceDashboard, FinanceDoc, FinanceDocKind, FinanceFile } from './models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/finance`;

  dashboard(): Observable<FinanceDashboard> { return this.http.get<FinanceDashboard>(`${this.base}/dashboard`); }
  analytics(): Observable<FinanceAnalytics> { return this.http.get<FinanceAnalytics>(`${this.base}/analytics`); }

  documents(filter?: { kind?: FinanceDocKind | null; status?: string | null; search?: string | null }): Observable<FinanceDoc[]> {
    let params = new HttpParams();
    if (filter?.kind) params = params.set('kind', filter.kind);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.search) params = params.set('search', filter.search);
    return this.http.get<FinanceDoc[]>(`${this.base}/documents`, { params });
  }
  createDocument(body: Partial<FinanceDoc> & { kind: FinanceDocKind; partner: string; amount: number }): Observable<FinanceDoc> {
    return this.http.post<FinanceDoc>(`${this.base}/documents`, body);
  }
  validate(id: string): Observable<FinanceDoc> { return this.http.post<FinanceDoc>(`${this.base}/documents/${id}/validate`, {}); }
  cancel(id: string): Observable<FinanceDoc> { return this.http.post<FinanceDoc>(`${this.base}/documents/${id}/cancel`, {}); }
  pay(id: string, amount?: number | null): Observable<FinanceDoc> { return this.http.post<FinanceDoc>(`${this.base}/documents/${id}/pay`, { amount: amount ?? null }); }

  expenses(status?: string | null): Observable<Expense[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Expense[]>(`${this.base}/expenses`, { params });
  }
  createExpense(body: { employee: string; category: string; description?: string; date?: string | null; amount: number }): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/expenses`, body);
  }
  expenseAction(id: string, action: 'submit' | 'approve' | 'reimburse' | 'refuse', note?: string | null): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/expenses/${id}/${action}`, { note: note ?? null });
  }

  bank(): Observable<BankAccountDto[]> { return this.http.get<BankAccountDto[]>(`${this.base}/bank`); }
  reconcile(id: string): Observable<unknown> { return this.http.post(`${this.base}/bank/transactions/${id}/reconcile`, {}); }

  files(signature?: 'sign' | null): Observable<FinanceFile[]> {
    let params = new HttpParams();
    if (signature) params = params.set('signature', signature);
    return this.http.get<FinanceFile[]>(`${this.base}/files`, { params });
  }
  createFile(name: string, category: string): Observable<FinanceFile> {
    return this.http.post<FinanceFile>(`${this.base}/files`, { name, category });
  }
  requestSignature(id: string, signer: string): Observable<FinanceFile> { return this.http.post<FinanceFile>(`${this.base}/files/${id}/request-signature`, { signer }); }
  sign(id: string): Observable<FinanceFile> { return this.http.post<FinanceFile>(`${this.base}/files/${id}/sign`, {}); }
}
