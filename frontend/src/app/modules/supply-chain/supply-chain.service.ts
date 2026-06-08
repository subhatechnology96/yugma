import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  EngineeringChange, ManufacturingOrder, MaintenanceRequest, PurchaseOrder, QualityCheck,
  StockItem, StockMove, SupplyChainSummary
} from './models';

@Injectable({ providedIn: 'root' })
export class SupplyChainService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/supply-chain`;
  private p(obj: Record<string, string | null | undefined>): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(obj)) if (v) params = params.set(k, v);
    return params;
  }

  summary(): Observable<SupplyChainSummary> { return this.http.get<SupplyChainSummary>(`${this.base}/summary`); }

  // Inventory
  stockItems(search?: string | null, category?: string | null): Observable<StockItem[]> { return this.http.get<StockItem[]>(`${this.base}/stock-items`, { params: this.p({ search, category }) }); }
  createStockItem(b: Partial<StockItem>): Observable<StockItem> { return this.http.post<StockItem>(`${this.base}/stock-items`, b); }
  updateStockItem(id: string, b: Partial<StockItem>): Observable<StockItem> { return this.http.put<StockItem>(`${this.base}/stock-items/${id}`, b); }
  stockMoves(type?: string | null, status?: string | null): Observable<StockMove[]> { return this.http.get<StockMove[]>(`${this.base}/stock-moves`, { params: this.p({ type, status }) }); }
  createStockMove(b: Partial<StockMove>): Observable<StockMove> { return this.http.post<StockMove>(`${this.base}/stock-moves`, b); }
  moveStatus(id: string, status: string): Observable<StockMove> { return this.http.post<StockMove>(`${this.base}/stock-moves/${id}/status`, { status }); }

  // Manufacturing
  manufacturingOrders(stage?: string | null, search?: string | null): Observable<ManufacturingOrder[]> { return this.http.get<ManufacturingOrder[]>(`${this.base}/manufacturing-orders`, { params: this.p({ stage, search }) }); }
  createMo(b: Partial<ManufacturingOrder>): Observable<ManufacturingOrder> { return this.http.post<ManufacturingOrder>(`${this.base}/manufacturing-orders`, b); }
  updateMo(id: string, b: Partial<ManufacturingOrder>): Observable<ManufacturingOrder> { return this.http.put<ManufacturingOrder>(`${this.base}/manufacturing-orders/${id}`, b); }
  moStage(id: string, status: string): Observable<ManufacturingOrder> { return this.http.post<ManufacturingOrder>(`${this.base}/manufacturing-orders/${id}/stage`, { status }); }

  // PLM
  ecos(stage?: string | null, search?: string | null): Observable<EngineeringChange[]> { return this.http.get<EngineeringChange[]>(`${this.base}/engineering-changes`, { params: this.p({ stage, search }) }); }
  createEco(b: Partial<EngineeringChange>): Observable<EngineeringChange> { return this.http.post<EngineeringChange>(`${this.base}/engineering-changes`, b); }
  updateEco(id: string, b: Partial<EngineeringChange>): Observable<EngineeringChange> { return this.http.put<EngineeringChange>(`${this.base}/engineering-changes/${id}`, b); }
  ecoStage(id: string, status: string): Observable<EngineeringChange> { return this.http.post<EngineeringChange>(`${this.base}/engineering-changes/${id}/stage`, { status }); }

  // Purchase
  purchaseOrders(status?: string | null, search?: string | null): Observable<PurchaseOrder[]> { return this.http.get<PurchaseOrder[]>(`${this.base}/purchase-orders`, { params: this.p({ status, search }) }); }
  purchaseOrder(id: string): Observable<PurchaseOrder> { return this.http.get<PurchaseOrder>(`${this.base}/purchase-orders/${id}`); }
  createPo(b: Partial<PurchaseOrder>): Observable<PurchaseOrder> { return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders`, b); }
  updatePo(id: string, b: Partial<PurchaseOrder>): Observable<PurchaseOrder> { return this.http.put<PurchaseOrder>(`${this.base}/purchase-orders/${id}`, b); }
  poAction(id: string, action: 'send' | 'confirm' | 'receive' | 'cancel' | 'draft'): Observable<PurchaseOrder> { return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders/${id}/${action}`, {}); }

  // Maintenance
  maintenance(stage?: string | null, search?: string | null): Observable<MaintenanceRequest[]> { return this.http.get<MaintenanceRequest[]>(`${this.base}/maintenance-requests`, { params: this.p({ stage, search }) }); }
  createMr(b: Partial<MaintenanceRequest>): Observable<MaintenanceRequest> { return this.http.post<MaintenanceRequest>(`${this.base}/maintenance-requests`, b); }
  updateMr(id: string, b: Partial<MaintenanceRequest>): Observable<MaintenanceRequest> { return this.http.put<MaintenanceRequest>(`${this.base}/maintenance-requests/${id}`, b); }
  mrStage(id: string, status: string): Observable<MaintenanceRequest> { return this.http.post<MaintenanceRequest>(`${this.base}/maintenance-requests/${id}/stage`, { status }); }

  // Quality
  qualityChecks(status?: string | null, search?: string | null): Observable<QualityCheck[]> { return this.http.get<QualityCheck[]>(`${this.base}/quality-checks`, { params: this.p({ status, search }) }); }
  createQc(b: Partial<QualityCheck>): Observable<QualityCheck> { return this.http.post<QualityCheck>(`${this.base}/quality-checks`, b); }
  updateQc(id: string, b: Partial<QualityCheck>): Observable<QualityCheck> { return this.http.put<QualityCheck>(`${this.base}/quality-checks/${id}`, b); }
  qcResult(id: string, status: string, note?: string | null): Observable<QualityCheck> { return this.http.post<QualityCheck>(`${this.base}/quality-checks/${id}/result`, { status, note: note ?? null }); }
}
