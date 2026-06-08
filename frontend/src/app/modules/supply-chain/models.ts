// ── Inventory ──
export interface StockItem {
  id: string; sku: string; name: string; category: string; location: string;
  onHand: number; reserved: number; forecast: number; reorderPoint: number;
  unitCost: number; uom: string; value: number; belowReorder: boolean;
}
export type StockMoveType = 'Receipt' | 'Delivery' | 'Internal' | 'Manufacturing';
export type StockMoveStatus = 'Draft' | 'Ready' | 'Done' | 'Cancelled';
export interface StockMove {
  id: string; reference: string; moveType: StockMoveType; status: StockMoveStatus;
  product: string; quantity: number; sourceLocation: string; destLocation: string;
  partner?: string | null; scheduledDate: string;
}

// ── Manufacturing ──
export type ManufacturingStage = 'Draft' | 'Confirmed' | 'InProgress' | 'Done' | 'Cancelled';
export interface BomComponent { product: string; quantity: number; uom: string; consumed: boolean; }
export interface ManufacturingOrder {
  id: string; reference: string; product: string; quantity: number; uom: string;
  stage: ManufacturingStage; responsible?: string | null; scheduledDate: string;
  source?: string | null; components: BomComponent[];
}

// ── PLM (Engineering Changes) ──
export type EcoStage = 'New' | 'InProgress' | 'Approved' | 'Done' | 'Rejected';
export type EcoType = 'BillOfMaterials' | 'ProductDesign' | 'Routing' | 'Documentation';
export interface EngineeringChange {
  id: string; reference: string; title: string; product: string; changeType: EcoType;
  stage: EcoStage; priority: number; responsible?: string | null; description?: string | null; effectiveDate?: string | null;
}

// ── Purchase ──
export type PurchaseStatus = 'Rfq' | 'Sent' | 'Purchase' | 'Received' | 'Cancelled';
export interface PurchaseLine {
  product: string; description?: string | null; quantity: number; unitPrice: number; taxPercent: number; subtotal: number; taxAmount: number;
}
export interface PurchaseOrder {
  id: string; number: string; status: PurchaseStatus; vendor: string; vendorEmail?: string | null;
  orderDate: string; expectedDate?: string | null; responsible?: string | null; notes?: string | null;
  untaxedAmount: number; taxAmount: number; total: number; lines: PurchaseLine[];
}

// ── Maintenance ──
export type MaintenanceStage = 'New' | 'InProgress' | 'Repaired' | 'Scrap';
export type MaintenanceKind = 'Corrective' | 'Preventive';
export interface MaintenanceRequest {
  id: string; reference: string; title: string; equipment: string; kind: MaintenanceKind;
  stage: MaintenanceStage; priority: number; responsible?: string | null; category?: string | null;
  scheduledDate?: string | null; duration: number; description?: string | null;
}

// ── Quality ──
export type QualityStatus = 'ToDo' | 'Pass' | 'Fail';
export type QualityCheckType = 'PassFail' | 'Measure' | 'Instructions';
export interface QualityCheck {
  id: string; reference: string; title: string; product: string; checkType: QualityCheckType;
  status: QualityStatus; controlPoint: string; sourceDocument?: string | null; responsible?: string | null;
  measure?: string | null; notes?: string | null;
}

export interface SupplyChainSummary {
  inventoryValue: number; skuCount: number; belowReorder: number; incomingMoves: number; outgoingMoves: number;
  manufacturingOpen: number; manufacturingDone: number; ecoOpen: number; purchaseRfq: number; purchaseValue: number;
  maintenanceOpen: number; qualityToDo: number; qualityFail: number;
}

// ── stage/status display metadata ──
export const MO_STAGES: { key: ManufacturingStage; label: string; dot: string; bar: string }[] = [
  { key: 'Draft', label: 'Draft', dot: 'bg-surface-400', bar: 'bg-surface-400' },
  { key: 'Confirmed', label: 'Confirmed', dot: 'bg-brand-400', bar: 'bg-brand-500' },
  { key: 'InProgress', label: 'In Progress', dot: 'bg-indigo-400', bar: 'bg-indigo-500' },
  { key: 'Done', label: 'Done', dot: 'bg-emerald-500', bar: 'bg-emerald-500' }
];
export const ECO_STAGES: { key: EcoStage; label: string; dot: string; bar: string }[] = [
  { key: 'New', label: 'New', dot: 'bg-surface-400', bar: 'bg-surface-400' },
  { key: 'InProgress', label: 'In Progress', dot: 'bg-brand-400', bar: 'bg-brand-500' },
  { key: 'Approved', label: 'Approved', dot: 'bg-amber-400', bar: 'bg-amber-500' },
  { key: 'Done', label: 'Done', dot: 'bg-emerald-500', bar: 'bg-emerald-500' }
];
export const MR_STAGES: { key: MaintenanceStage; label: string; dot: string; bar: string }[] = [
  { key: 'New', label: 'New Request', dot: 'bg-surface-400', bar: 'bg-surface-400' },
  { key: 'InProgress', label: 'In Progress', dot: 'bg-indigo-400', bar: 'bg-indigo-500' },
  { key: 'Repaired', label: 'Repaired', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { key: 'Scrap', label: 'Scrap', dot: 'bg-rose-400', bar: 'bg-rose-500' }
];
export const PURCHASE_STATUS_META: Record<PurchaseStatus, { label: string; tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  Rfq: { label: 'RFQ', tone: 'neutral' },
  Sent: { label: 'RFQ Sent', tone: 'info' },
  Purchase: { label: 'Purchase Order', tone: 'success' },
  Received: { label: 'Received', tone: 'success' },
  Cancelled: { label: 'Cancelled', tone: 'danger' }
};
export const MOVE_TYPE_META: Record<StockMoveType, { label: string; icon: string }> = {
  Receipt: { label: 'Receipt', icon: 'pi-arrow-down-left' },
  Delivery: { label: 'Delivery', icon: 'pi-arrow-up-right' },
  Internal: { label: 'Internal', icon: 'pi-arrows-h' },
  Manufacturing: { label: 'Manufacturing', icon: 'pi-cog' }
};
export const MOVE_STATUS_META: Record<StockMoveStatus, { label: string; tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  Draft: { label: 'Draft', tone: 'neutral' },
  Ready: { label: 'Ready', tone: 'info' },
  Done: { label: 'Done', tone: 'success' },
  Cancelled: { label: 'Cancelled', tone: 'danger' }
};
export const QUALITY_STATUS_META: Record<QualityStatus, { label: string; tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  ToDo: { label: 'To Do', tone: 'warn' },
  Pass: { label: 'Passed', tone: 'success' },
  Fail: { label: 'Failed', tone: 'danger' }
};
export const ECO_TYPE_LABELS: Record<EcoType, string> = {
  BillOfMaterials: 'Bill of Materials', ProductDesign: 'Product Design', Routing: 'Routing', Documentation: 'Documentation'
};
