using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.SupplyChain;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Supply Chain module — Inventory, Manufacturing, PLM, Purchase, Maintenance and Quality.
/// Department-gated via the "supplychain" role (admins/owners included). Reads SupplyChainView, writes SupplyChainEdit.
/// </summary>
[ApiController]
[Route("api/supply-chain")]
[Produces("application/json")]
[Authorize(Policy = "SupplyChainView")]
public sealed class SupplyChainController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
    private string Actor() => User.Identity?.Name ?? tenant.UserName ?? "Supply chain";
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    // ─────────────────────────── Inventory ───────────────────────────

    [HttpGet("stock-items")]
    public async Task<IActionResult> StockItems([FromQuery] string? search = null, [FromQuery] string? category = null, CancellationToken ct = default)
    {
        var q = db.StockItems.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(category) && category != "All") q = q.Where(i => i.Category == category);
        if (!string.IsNullOrWhiteSpace(search)) { var k = search.Trim(); q = q.Where(i => EF.Functions.ILike(i.Name, $"%{k}%") || EF.Functions.ILike(i.Sku, $"%{k}%")); }
        var rows = await q.OrderBy(i => i.Name).ToListAsync(ct);
        return Ok(rows.Select(ItemDto));
    }

    [HttpPost("stock-items")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreateStockItem([FromBody] ItemBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { message = "Name is required." });
        var sku = string.IsNullOrWhiteSpace(body.Sku) ? await NextRefAsync(db.StockItems.Select(i => i.Sku), "SKU-", 1000, ct) : body.Sku!.Trim();
        var i = StockItem.Create(tenant.TenantId, sku, body.Name!, body.Category ?? "All", body.Location ?? "WH/Stock",
            body.OnHand ?? 0, body.Reserved ?? 0, body.ReorderPoint ?? 0, body.UnitCost ?? 0, body.Uom ?? "Units", Actor());
        db.StockItems.Add(i); await db.SaveChangesAsync(ct);
        return Ok(ItemDto(i));
    }

    [HttpPut("stock-items/{id:guid}")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> UpdateStockItem(Guid id, [FromBody] ItemBody body, CancellationToken ct)
    {
        var i = await db.StockItems.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (i is null) return NotFound();
        i.Update(body.Name ?? i.Name, body.Category ?? i.Category, body.Location ?? i.Location, body.OnHand ?? i.OnHand,
            body.Reserved ?? i.Reserved, body.ReorderPoint ?? i.ReorderPoint, body.UnitCost ?? i.UnitCost, body.Uom ?? i.Uom, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ItemDto(i));
    }

    [HttpGet("stock-moves")]
    public async Task<IActionResult> StockMoves([FromQuery] string? type = null, [FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = db.StockMoves.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<StockMoveType>(type, true, out var t)) q = q.Where(m => m.MoveType == t);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<StockMoveStatus>(status, true, out var s)) q = q.Where(m => m.Status == s);
        var rows = await q.OrderByDescending(m => m.ScheduledDate).ThenByDescending(m => m.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(MoveDto));
    }

    [HttpPost("stock-moves")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreateStockMove([FromBody] MoveBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Product)) return BadRequest(new { message = "Product is required." });
        var type = Enum.TryParse<StockMoveType>(body.MoveType, true, out var t) ? t : StockMoveType.Receipt;
        var (src, dst) = DefaultLocations(type, body.SourceLocation, body.DestLocation);
        var prefix = type switch { StockMoveType.Receipt => "WH/IN/", StockMoveType.Delivery => "WH/OUT/", StockMoveType.Internal => "WH/INT/", _ => "WH/MO/" };
        var m = StockMove.Create(tenant.TenantId, await NextRefAsync(db.StockMoves.Select(x => x.Reference), prefix, 0, ct, "00000"),
            type, body.Product!, body.Quantity ?? 1, src, dst, body.ScheduledDate ?? Today, StockMoveStatus.Draft, body.Partner, Actor());
        db.StockMoves.Add(m); await db.SaveChangesAsync(ct);
        return Ok(MoveDto(m));
    }

    [HttpPost("stock-moves/{id:guid}/status")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> MoveStatus(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        var m = await db.StockMoves.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (m is null) return NotFound();
        if (!Enum.TryParse<StockMoveStatus>(body.Status, true, out var s)) return BadRequest(new { message = "Unknown status." });
        m.SetStatus(s, Actor()); await db.SaveChangesAsync(ct);
        return Ok(MoveDto(m));
    }

    // ─────────────────────────── Manufacturing ───────────────────────────

    [HttpGet("manufacturing-orders")]
    public async Task<IActionResult> ManufacturingOrders([FromQuery] string? stage = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.ManufacturingOrders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<ManufacturingStage>(stage, true, out var s)) q = q.Where(m => m.Stage == s);
        if (!string.IsNullOrWhiteSpace(search)) { var k = search.Trim(); q = q.Where(m => EF.Functions.ILike(m.Product, $"%{k}%") || EF.Functions.ILike(m.Reference, $"%{k}%")); }
        var rows = await q.OrderByDescending(m => m.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(MoDto));
    }

    [HttpPost("manufacturing-orders")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreateMo([FromBody] MoBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Product)) return BadRequest(new { message = "Product is required." });
        var stage = Enum.TryParse<ManufacturingStage>(body.Stage, true, out var s) ? s : ManufacturingStage.Draft;
        var mo = ManufacturingOrder.Create(tenant.TenantId, await NextRefAsync(db.ManufacturingOrders.Select(m => m.Reference), "MO/", 0, ct, "00000"),
            body.Product!, body.Quantity ?? 1, body.ScheduledDate ?? Today, stage, body.Uom ?? "Units", body.Responsible, body.Source, MapComponents(body.Components), Actor());
        db.ManufacturingOrders.Add(mo); await db.SaveChangesAsync(ct);
        return Ok(MoDto(mo));
    }

    [HttpPut("manufacturing-orders/{id:guid}")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> UpdateMo(Guid id, [FromBody] MoBody body, CancellationToken ct)
    {
        var mo = await db.ManufacturingOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (mo is null) return NotFound();
        mo.Update(body.Product ?? mo.Product, body.Quantity ?? mo.Quantity, body.Uom ?? mo.Uom, body.Responsible, body.ScheduledDate ?? mo.ScheduledDate,
            body.Components is null ? null : MapComponents(body.Components), Actor());
        await db.SaveChangesAsync(ct);
        return Ok(MoDto(mo));
    }

    [HttpPost("manufacturing-orders/{id:guid}/stage")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> MoStage(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        var mo = await db.ManufacturingOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (mo is null) return NotFound();
        if (!Enum.TryParse<ManufacturingStage>(body.Status, true, out var s)) return BadRequest(new { message = "Unknown stage." });
        mo.MoveStage(s, Actor()); await db.SaveChangesAsync(ct);
        return Ok(MoDto(mo));
    }

    // ─────────────────────────── PLM (Engineering Changes) ───────────────────────────

    [HttpGet("engineering-changes")]
    public async Task<IActionResult> Ecos([FromQuery] string? stage = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.EngineeringChanges.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<EcoStage>(stage, true, out var s)) q = q.Where(e => e.Stage == s);
        if (!string.IsNullOrWhiteSpace(search)) { var k = search.Trim(); q = q.Where(e => EF.Functions.ILike(e.Title, $"%{k}%") || EF.Functions.ILike(e.Reference, $"%{k}%")); }
        var rows = await q.OrderByDescending(e => e.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(EcoDto));
    }

    [HttpPost("engineering-changes")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreateEco([FromBody] EcoBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title)) return BadRequest(new { message = "Title is required." });
        var stage = Enum.TryParse<EcoStage>(body.Stage, true, out var s) ? s : EcoStage.New;
        var type = Enum.TryParse<EcoType>(body.ChangeType, true, out var t) ? t : EcoType.BillOfMaterials;
        var eco = EngineeringChange.Create(tenant.TenantId, await NextRefAsync(db.EngineeringChanges.Select(e => e.Reference), "ECO/", 0, ct, "00000"),
            body.Title!, body.Product ?? "—", type, stage, body.Priority ?? 0, body.Responsible, body.Description, body.EffectiveDate, Actor());
        db.EngineeringChanges.Add(eco); await db.SaveChangesAsync(ct);
        return Ok(EcoDto(eco));
    }

    [HttpPut("engineering-changes/{id:guid}")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> UpdateEco(Guid id, [FromBody] EcoBody body, CancellationToken ct)
    {
        var eco = await db.EngineeringChanges.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (eco is null) return NotFound();
        var type = Enum.TryParse<EcoType>(body.ChangeType, true, out var t) ? t : eco.ChangeType;
        eco.Update(body.Title ?? eco.Title, body.Product ?? eco.Product, type, body.Priority ?? eco.Priority, body.Responsible, body.Description, body.EffectiveDate, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(EcoDto(eco));
    }

    [HttpPost("engineering-changes/{id:guid}/stage")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> EcoMoveStage(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        var eco = await db.EngineeringChanges.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (eco is null) return NotFound();
        if (!Enum.TryParse<EcoStage>(body.Status, true, out var s)) return BadRequest(new { message = "Unknown stage." });
        eco.MoveStage(s, Actor()); await db.SaveChangesAsync(ct);
        return Ok(EcoDto(eco));
    }

    // ─────────────────────────── Purchase ───────────────────────────

    [HttpGet("purchase-orders")]
    public async Task<IActionResult> PurchaseOrders([FromQuery] string? status = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.PurchaseOrders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PurchaseStatus>(status, true, out var s)) q = q.Where(p => p.Status == s);
        if (!string.IsNullOrWhiteSpace(search)) { var k = search.Trim(); q = q.Where(p => EF.Functions.ILike(p.Number, $"%{k}%") || EF.Functions.ILike(p.Vendor, $"%{k}%")); }
        var rows = await q.OrderByDescending(p => p.OrderDate).ThenByDescending(p => p.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(PoDto));
    }

    [HttpGet("purchase-orders/{id:guid}")]
    public async Task<IActionResult> PurchaseOrderById(Guid id, CancellationToken ct)
    {
        var p = await db.PurchaseOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return p is null ? NotFound() : Ok(PoDto(p));
    }

    [HttpPost("purchase-orders")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreatePo([FromBody] PoBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Vendor)) return BadRequest(new { message = "Vendor is required." });
        var order = body.OrderDate ?? Today;
        var po = PurchaseOrder.Create(tenant.TenantId, await NextRefAsync(db.PurchaseOrders.Select(p => p.Number), "P", 0, ct, "00000"),
            body.Vendor!, order, PurchaseStatus.Rfq, body.ExpectedDate ?? order.AddDays(7), body.VendorEmail, body.Responsible, body.Notes, MapPoLines(body.Lines), Actor());
        db.PurchaseOrders.Add(po); await db.SaveChangesAsync(ct);
        return Ok(PoDto(po));
    }

    [HttpPut("purchase-orders/{id:guid}")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> UpdatePo(Guid id, [FromBody] PoBody body, CancellationToken ct)
    {
        var po = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (po is null) return NotFound();
        po.UpdateHeader(body.Vendor ?? po.Vendor, body.VendorEmail, body.OrderDate ?? po.OrderDate, body.ExpectedDate, body.Responsible, body.Notes, Actor());
        if (body.Lines is not null) po.SetLines(MapPoLines(body.Lines), Actor());
        await db.SaveChangesAsync(ct);
        return Ok(PoDto(po));
    }

    [HttpPost("purchase-orders/{id:guid}/send")]
    [Authorize(Policy = "SupplyChainEdit")]
    public Task<IActionResult> SendPo(Guid id, CancellationToken ct) => PoAction(id, p => p.Send(Actor()), ct);
    [HttpPost("purchase-orders/{id:guid}/confirm")]
    [Authorize(Policy = "SupplyChainEdit")]
    public Task<IActionResult> ConfirmPo(Guid id, CancellationToken ct) => PoAction(id, p => p.Confirm(Actor()), ct);
    [HttpPost("purchase-orders/{id:guid}/receive")]
    [Authorize(Policy = "SupplyChainEdit")]
    public Task<IActionResult> ReceivePo(Guid id, CancellationToken ct) => PoAction(id, p => p.Receive(Actor()), ct);
    [HttpPost("purchase-orders/{id:guid}/cancel")]
    [Authorize(Policy = "SupplyChainEdit")]
    public Task<IActionResult> CancelPo(Guid id, CancellationToken ct) => PoAction(id, p => p.Cancel(Actor()), ct);
    [HttpPost("purchase-orders/{id:guid}/draft")]
    [Authorize(Policy = "SupplyChainEdit")]
    public Task<IActionResult> DraftPo(Guid id, CancellationToken ct) => PoAction(id, p => p.SetDraft(Actor()), ct);

    // ─────────────────────────── Maintenance ───────────────────────────

    [HttpGet("maintenance-requests")]
    public async Task<IActionResult> Maintenance([FromQuery] string? stage = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.MaintenanceRequests.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<MaintenanceStage>(stage, true, out var s)) q = q.Where(m => m.Stage == s);
        if (!string.IsNullOrWhiteSpace(search)) { var k = search.Trim(); q = q.Where(m => EF.Functions.ILike(m.Title, $"%{k}%") || EF.Functions.ILike(m.Equipment, $"%{k}%")); }
        var rows = await q.OrderByDescending(m => m.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(MrDto));
    }

    [HttpPost("maintenance-requests")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreateMr([FromBody] MrBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Equipment)) return BadRequest(new { message = "Title and equipment are required." });
        var stage = Enum.TryParse<MaintenanceStage>(body.Stage, true, out var s) ? s : MaintenanceStage.New;
        var kind = Enum.TryParse<MaintenanceKind>(body.Kind, true, out var k) ? k : MaintenanceKind.Corrective;
        var mr = MaintenanceRequest.Create(tenant.TenantId, await NextRefAsync(db.MaintenanceRequests.Select(m => m.Reference), "MR/", 0, ct, "00000"),
            body.Title!, body.Equipment!, kind, stage, body.Priority ?? 0, body.Responsible, body.Category, body.ScheduledDate, body.Duration ?? 0, body.Description, Actor());
        db.MaintenanceRequests.Add(mr); await db.SaveChangesAsync(ct);
        return Ok(MrDto(mr));
    }

    [HttpPut("maintenance-requests/{id:guid}")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> UpdateMr(Guid id, [FromBody] MrBody body, CancellationToken ct)
    {
        var mr = await db.MaintenanceRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (mr is null) return NotFound();
        var kind = Enum.TryParse<MaintenanceKind>(body.Kind, true, out var k) ? k : mr.Kind;
        mr.Update(body.Title ?? mr.Title, body.Equipment ?? mr.Equipment, kind, body.Priority ?? mr.Priority, body.Responsible, body.Category, body.ScheduledDate, body.Duration ?? mr.Duration, body.Description, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(MrDto(mr));
    }

    [HttpPost("maintenance-requests/{id:guid}/stage")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> MrStage(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        var mr = await db.MaintenanceRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (mr is null) return NotFound();
        if (!Enum.TryParse<MaintenanceStage>(body.Status, true, out var s)) return BadRequest(new { message = "Unknown stage." });
        mr.MoveStage(s, Actor()); await db.SaveChangesAsync(ct);
        return Ok(MrDto(mr));
    }

    // ─────────────────────────── Quality ───────────────────────────

    [HttpGet("quality-checks")]
    public async Task<IActionResult> QualityChecks([FromQuery] string? status = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.QualityChecks.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QualityStatus>(status, true, out var s)) q = q.Where(c => c.Status == s);
        if (!string.IsNullOrWhiteSpace(search)) { var k = search.Trim(); q = q.Where(c => EF.Functions.ILike(c.Title, $"%{k}%") || EF.Functions.ILike(c.Reference, $"%{k}%")); }
        var rows = await q.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(QcDto));
    }

    [HttpPost("quality-checks")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> CreateQc([FromBody] QcBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title)) return BadRequest(new { message = "Title is required." });
        var type = Enum.TryParse<QualityCheckType>(body.CheckType, true, out var t) ? t : QualityCheckType.PassFail;
        var status = Enum.TryParse<QualityStatus>(body.Status, true, out var s) ? s : QualityStatus.ToDo;
        var qc = QualityCheck.Create(tenant.TenantId, await NextRefAsync(db.QualityChecks.Select(c => c.Reference), "QC/", 0, ct, "00000"),
            body.Title!, body.Product ?? "—", type, body.ControlPoint ?? "Receipt", status, body.SourceDocument, body.Responsible, body.Measure, body.Notes, Actor());
        db.QualityChecks.Add(qc); await db.SaveChangesAsync(ct);
        return Ok(QcDto(qc));
    }

    [HttpPut("quality-checks/{id:guid}")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> UpdateQc(Guid id, [FromBody] QcBody body, CancellationToken ct)
    {
        var qc = await db.QualityChecks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (qc is null) return NotFound();
        var type = Enum.TryParse<QualityCheckType>(body.CheckType, true, out var t) ? t : qc.CheckType;
        qc.Update(body.Title ?? qc.Title, body.Product ?? qc.Product, type, body.ControlPoint ?? qc.ControlPoint, body.SourceDocument, body.Responsible, body.Measure, body.Notes, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(QcDto(qc));
    }

    [HttpPost("quality-checks/{id:guid}/result")]
    [Authorize(Policy = "SupplyChainEdit")]
    public async Task<IActionResult> QcResult(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        var qc = await db.QualityChecks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (qc is null) return NotFound();
        if (!Enum.TryParse<QualityStatus>(body.Status, true, out var s)) return BadRequest(new { message = "Unknown status." });
        qc.SetResult(s, body.Note, Actor()); await db.SaveChangesAsync(ct);
        return Ok(QcDto(qc));
    }

    // ─────────────────────────── Dashboard ───────────────────────────

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var items = await db.StockItems.AsNoTracking().ToListAsync(ct);
        var mos = await db.ManufacturingOrders.AsNoTracking().ToListAsync(ct);
        var pos = await db.PurchaseOrders.AsNoTracking().ToListAsync(ct);
        var mrs = await db.MaintenanceRequests.AsNoTracking().ToListAsync(ct);
        var qcs = await db.QualityChecks.AsNoTracking().ToListAsync(ct);
        return Ok(new
        {
            inventoryValue = Math.Round(items.Sum(i => i.OnHand * i.UnitCost), 0),
            skuCount = items.Count,
            belowReorder = items.Count(i => i.OnHand <= i.ReorderPoint),
            incomingMoves = await db.StockMoves.AsNoTracking().CountAsync(m => m.MoveType == StockMoveType.Receipt && m.Status != StockMoveStatus.Done, ct),
            outgoingMoves = await db.StockMoves.AsNoTracking().CountAsync(m => m.MoveType == StockMoveType.Delivery && m.Status != StockMoveStatus.Done, ct),
            manufacturingOpen = mos.Count(m => m.Stage is ManufacturingStage.Confirmed or ManufacturingStage.InProgress),
            manufacturingDone = mos.Count(m => m.Stage == ManufacturingStage.Done),
            ecoOpen = await db.EngineeringChanges.AsNoTracking().CountAsync(e => e.Stage != EcoStage.Done && e.Stage != EcoStage.Rejected, ct),
            purchaseRfq = pos.Count(p => p.Status is PurchaseStatus.Rfq or PurchaseStatus.Sent),
            purchaseValue = pos.Where(p => p.Status is PurchaseStatus.Purchase or PurchaseStatus.Received).Sum(p => p.Total),
            maintenanceOpen = mrs.Count(m => m.Stage is MaintenanceStage.New or MaintenanceStage.InProgress),
            qualityToDo = qcs.Count(c => c.Status == QualityStatus.ToDo),
            qualityFail = qcs.Count(c => c.Status == QualityStatus.Fail)
        });
    }

    // ─────────────────────────── helpers ───────────────────────────

    private async Task<IActionResult> PoAction(Guid id, Action<PurchaseOrder> act, CancellationToken ct)
    {
        var p = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        act(p); await db.SaveChangesAsync(ct);
        return Ok(PoDto(p));
    }

    private static (string src, string dst) DefaultLocations(StockMoveType type, string? src, string? dst) => type switch
    {
        StockMoveType.Receipt => (string.IsNullOrWhiteSpace(src) ? "Vendors" : src!, string.IsNullOrWhiteSpace(dst) ? "WH/Stock" : dst!),
        StockMoveType.Delivery => (string.IsNullOrWhiteSpace(src) ? "WH/Stock" : src!, string.IsNullOrWhiteSpace(dst) ? "Customers" : dst!),
        _ => (string.IsNullOrWhiteSpace(src) ? "WH/Stock" : src!, string.IsNullOrWhiteSpace(dst) ? "WH/Stock" : dst!)
    };

    private static List<BomComponent> MapComponents(IEnumerable<ComponentBody>? c) =>
        (c ?? Enumerable.Empty<ComponentBody>()).Where(x => !string.IsNullOrWhiteSpace(x.Product))
            .Select(x => new BomComponent { Product = x.Product!.Trim(), Quantity = x.Quantity <= 0 ? 1 : x.Quantity, Uom = string.IsNullOrWhiteSpace(x.Uom) ? "Units" : x.Uom!, Consumed = x.Consumed }).ToList();

    private static List<PurchaseLine> MapPoLines(IEnumerable<PoLineBody>? lines) =>
        (lines ?? Enumerable.Empty<PoLineBody>()).Where(l => !string.IsNullOrWhiteSpace(l.Product))
            .Select(l => new PurchaseLine { Product = l.Product!.Trim(), Description = l.Description, Quantity = l.Quantity <= 0 ? 1 : l.Quantity, UnitPrice = l.UnitPrice < 0 ? 0 : l.UnitPrice, TaxPercent = l.TaxPercent < 0 ? 0 : l.TaxPercent }).ToList();

    private async Task<string> NextRefAsync(IQueryable<string> source, string prefix, int start, CancellationToken ct, string? pad = null)
    {
        var refs = await source.ToListAsync(ct);
        var next = refs.Select(r => int.TryParse(new string(r.Where(char.IsDigit).ToArray()), out var n) ? n : 0).DefaultIfEmpty(start).Max() + 1;
        return pad is null ? $"{prefix}{next}" : $"{prefix}{next.ToString(pad)}";
    }

    private static object ItemDto(StockItem i) => new { id = i.Id, sku = i.Sku, name = i.Name, category = i.Category, location = i.Location, onHand = i.OnHand, reserved = i.Reserved, forecast = i.Forecast, reorderPoint = i.ReorderPoint, unitCost = i.UnitCost, uom = i.Uom, value = Math.Round(i.OnHand * i.UnitCost, 2), belowReorder = i.OnHand <= i.ReorderPoint };
    private static object MoveDto(StockMove m) => new { id = m.Id, reference = m.Reference, moveType = m.MoveType.ToString(), status = m.Status.ToString(), product = m.Product, quantity = m.Quantity, sourceLocation = m.SourceLocation, destLocation = m.DestLocation, partner = m.Partner, scheduledDate = m.ScheduledDate };
    private static object MoDto(ManufacturingOrder m) => new { id = m.Id, reference = m.Reference, product = m.Product, quantity = m.Quantity, uom = m.Uom, stage = m.Stage.ToString(), responsible = m.Responsible, scheduledDate = m.ScheduledDate, source = m.Source, components = m.Components.Select(c => new { product = c.Product, quantity = c.Quantity, uom = c.Uom, consumed = c.Consumed }) };
    private static object EcoDto(EngineeringChange e) => new { id = e.Id, reference = e.Reference, title = e.Title, product = e.Product, changeType = e.ChangeType.ToString(), stage = e.Stage.ToString(), priority = e.Priority, responsible = e.Responsible, description = e.Description, effectiveDate = e.EffectiveDate };
    private static object PoDto(PurchaseOrder p) => new { id = p.Id, number = p.Number, status = p.Status.ToString(), vendor = p.Vendor, vendorEmail = p.VendorEmail, orderDate = p.OrderDate, expectedDate = p.ExpectedDate, responsible = p.Responsible, notes = p.Notes, untaxedAmount = p.UntaxedAmount, taxAmount = p.TaxAmount, total = p.Total, lines = p.Lines.Select(l => new { product = l.Product, description = l.Description, quantity = l.Quantity, unitPrice = l.UnitPrice, taxPercent = l.TaxPercent, subtotal = l.Subtotal, taxAmount = l.TaxAmount }) };
    private static object MrDto(MaintenanceRequest m) => new { id = m.Id, reference = m.Reference, title = m.Title, equipment = m.Equipment, kind = m.Kind.ToString(), stage = m.Stage.ToString(), priority = m.Priority, responsible = m.Responsible, category = m.Category, scheduledDate = m.ScheduledDate, duration = m.Duration, description = m.Description };
    private static object QcDto(QualityCheck c) => new { id = c.Id, reference = c.Reference, title = c.Title, product = c.Product, checkType = c.CheckType.ToString(), status = c.Status.ToString(), controlPoint = c.ControlPoint, sourceDocument = c.SourceDocument, responsible = c.Responsible, measure = c.Measure, notes = c.Notes };

    public sealed record ItemBody(string? Sku, string? Name, string? Category, string? Location, decimal? OnHand, decimal? Reserved, decimal? ReorderPoint, decimal? UnitCost, string? Uom);
    public sealed record MoveBody(string? MoveType, string? Product, decimal? Quantity, string? SourceLocation, string? DestLocation, string? Partner, DateOnly? ScheduledDate);
    public sealed record ComponentBody(string? Product, decimal Quantity, string? Uom, bool Consumed);
    public sealed record MoBody(string? Product, decimal? Quantity, string? Uom, string? Stage, string? Responsible, string? Source, DateOnly? ScheduledDate, List<ComponentBody>? Components);
    public sealed record EcoBody(string? Title, string? Product, string? ChangeType, string? Stage, int? Priority, string? Responsible, string? Description, DateOnly? EffectiveDate);
    public sealed record PoLineBody(string? Product, string? Description, decimal Quantity, decimal UnitPrice, decimal TaxPercent);
    public sealed record PoBody(string? Vendor, string? VendorEmail, DateOnly? OrderDate, DateOnly? ExpectedDate, string? Responsible, string? Notes, List<PoLineBody>? Lines);
    public sealed record MrBody(string? Title, string? Equipment, string? Kind, string? Stage, int? Priority, string? Responsible, string? Category, DateOnly? ScheduledDate, decimal? Duration, string? Description);
    public sealed record QcBody(string? Title, string? Product, string? CheckType, string? Status, string? ControlPoint, string? SourceDocument, string? Responsible, string? Measure, string? Notes);
    public sealed record StatusBody(string Status, string? Note);
}
