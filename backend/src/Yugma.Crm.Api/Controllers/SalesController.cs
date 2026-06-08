using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Sales;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Sales module — CRM pipeline (opportunities), the product catalog and quotations/sales orders.
/// Department-gated via the "sales" role (admins/owners included). Reads use SalesView, writes SalesEdit.
/// </summary>
[ApiController]
[Route("api/sales")]
[Produces("application/json")]
[Authorize(Policy = "SalesView")]
public sealed class SalesController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
    private string Actor() => User.Identity?.Name ?? tenant.UserName ?? "Sales";
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    // ───────────────────────────── CRM · Opportunities ─────────────────────────────

    [HttpGet("opportunities")]
    public async Task<IActionResult> Opportunities([FromQuery] string? stage = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.Opportunities.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<SalesStage>(stage, true, out var s)) q = q.Where(o => o.Stage == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var k = search.Trim();
            q = q.Where(o => EF.Functions.ILike(o.Name, $"%{k}%") || EF.Functions.ILike(o.Customer, $"%{k}%"));
        }
        var rows = await q.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(OppDto));
    }

    [HttpGet("opportunities/{id:guid}")]
    public async Task<IActionResult> OpportunityById(Guid id, CancellationToken ct)
    {
        var o = await db.Opportunities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return o is null ? NotFound() : Ok(OppDto(o));
    }

    [HttpGet("crm-summary")]
    public async Task<IActionResult> CrmSummary(CancellationToken ct)
    {
        var all = await db.Opportunities.AsNoTracking().ToListAsync(ct);
        var open = all.Where(o => o.Stage != SalesStage.Won && o.Stage != SalesStage.Lost).ToList();
        decimal weighted = open.Sum(o => o.ExpectedRevenue * o.Probability / 100m);
        var byStage = Enum.GetValues<SalesStage>().Select(s => new
        {
            stage = s.ToString(),
            count = all.Count(o => o.Stage == s),
            value = all.Where(o => o.Stage == s).Sum(o => o.ExpectedRevenue)
        });
        return Ok(new
        {
            totalOpen = open.Count,
            pipelineValue = open.Sum(o => o.ExpectedRevenue),
            weightedValue = Math.Round(weighted, 0),
            won = all.Count(o => o.Stage == SalesStage.Won),
            wonValue = all.Where(o => o.Stage == SalesStage.Won).Sum(o => o.ExpectedRevenue),
            lost = all.Count(o => o.Stage == SalesStage.Lost),
            byStage
        });
    }

    [HttpPost("opportunities")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> CreateOpportunity([FromBody] OppBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Customer))
            return BadRequest(new { message = "Name and customer are required." });
        var stage = Enum.TryParse<SalesStage>(body.Stage, true, out var s) ? s : SalesStage.New;
        var o = Opportunity.Create(tenant.TenantId, await NextOppCodeAsync(ct), body.Name!, body.Customer!,
            stage, body.ExpectedRevenue ?? 0, body.Probability, body.Priority ?? 0, body.ContactName, body.Email,
            body.Phone, body.Salesperson, body.ExpectedClosing, body.Source, body.Description, body.Tags, Actor());
        db.Opportunities.Add(o);
        await db.SaveChangesAsync(ct);
        return Ok(OppDto(o));
    }

    [HttpPut("opportunities/{id:guid}")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> UpdateOpportunity(Guid id, [FromBody] OppBody body, CancellationToken ct)
    {
        var o = await db.Opportunities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        o.Update(body.Name ?? o.Name, body.Customer ?? o.Customer, body.ContactName, body.Email, body.Phone,
            body.Salesperson, body.ExpectedRevenue ?? o.ExpectedRevenue, body.Probability ?? o.Probability,
            body.Priority ?? o.Priority, body.ExpectedClosing, body.Source, body.Description, body.Tags, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(OppDto(o));
    }

    [HttpPost("opportunities/{id:guid}/stage")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> MoveStage(Guid id, [FromBody] StageBody body, CancellationToken ct)
    {
        var o = await db.Opportunities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        if (!Enum.TryParse<SalesStage>(body.Stage, true, out var s)) return BadRequest(new { message = "Unknown stage." });
        o.MoveStage(s, Actor(), body.Note);
        await db.SaveChangesAsync(ct);
        return Ok(OppDto(o));
    }

    [HttpPost("opportunities/{id:guid}/activity")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> AddActivity(Guid id, [FromBody] ActivityBody body, CancellationToken ct)
    {
        var o = await db.Opportunities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        if (string.IsNullOrWhiteSpace(body.Summary)) return BadRequest(new { message = "Summary is required." });
        o.AddActivity(body.Kind ?? "todo", body.Summary!, body.DueDate, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(OppDto(o));
    }

    [HttpPost("opportunities/{id:guid}/activity/{index:int}/done")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> CompleteActivity(Guid id, int index, CancellationToken ct)
    {
        var o = await db.Opportunities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        o.CompleteActivity(index, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(OppDto(o));
    }

    // ───────────────────────────── Products ─────────────────────────────

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] string? search = null, [FromQuery] string? category = null, CancellationToken ct = default)
    {
        var q = db.Products.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(category) && category != "All") q = q.Where(p => p.Category == category);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var k = search.Trim();
            q = q.Where(p => EF.Functions.ILike(p.Name, $"%{k}%") || EF.Functions.ILike(p.Code, $"%{k}%"));
        }
        var rows = await q.OrderBy(p => p.Name).ToListAsync(ct);
        return Ok(rows.Select(ProductDto));
    }

    [HttpPost("products")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> CreateProduct([FromBody] ProductBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { message = "Name is required." });
        var code = string.IsNullOrWhiteSpace(body.Code) ? await NextProductCodeAsync(ct) : body.Code!.Trim();
        var p = Product.Create(tenant.TenantId, code, body.Name!, body.UnitPrice ?? 0, body.Category ?? "All",
            body.TaxPercent ?? 18, body.OnHand ?? 0, body.Uom ?? "Units", body.Description, Actor());
        db.Products.Add(p);
        await db.SaveChangesAsync(ct);
        return Ok(ProductDto(p));
    }

    [HttpPut("products/{id:guid}")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] ProductBody body, CancellationToken ct)
    {
        var p = await db.Products.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        p.Update(body.Name ?? p.Name, body.Category ?? p.Category, body.UnitPrice ?? p.UnitPrice,
            body.TaxPercent ?? p.TaxPercent, body.OnHand ?? p.OnHand, body.Uom ?? p.Uom, body.Description, body.Active ?? p.Active, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ProductDto(p));
    }

    // ───────────────────────────── Quotations / Sales orders ─────────────────────────────

    [HttpGet("quotations")]
    public async Task<IActionResult> Quotations([FromQuery] string? status = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.Quotations.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QuotationStatus>(status, true, out var s)) q = q.Where(x => x.Status == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var k = search.Trim();
            q = q.Where(x => EF.Functions.ILike(x.Number, $"%{k}%") || EF.Functions.ILike(x.Customer, $"%{k}%"));
        }
        var rows = await q.OrderByDescending(x => x.OrderDate).ThenByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(QuoteDto));
    }

    [HttpGet("quotations/{id:guid}")]
    public async Task<IActionResult> QuotationById(Guid id, CancellationToken ct)
    {
        var x = await db.Quotations.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id, ct);
        return x is null ? NotFound() : Ok(QuoteDto(x));
    }

    [HttpPost("quotations")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> CreateQuotation([FromBody] QuoteBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Customer)) return BadRequest(new { message = "Customer is required." });
        var orderDate = body.OrderDate ?? Today;
        var x = Quotation.Create(tenant.TenantId, await NextQuoteNumberAsync(ct), body.Customer!, orderDate,
            QuotationStatus.Quotation, body.ExpiryDate ?? orderDate.AddDays(15), body.CustomerEmail, body.CustomerAddress,
            body.Pricelist ?? "INR", body.PaymentTerms ?? "30 Days", body.Salesperson, body.OpportunityId,
            body.Notes, MapLines(body.Lines), Actor());
        db.Quotations.Add(x);
        await db.SaveChangesAsync(ct);
        return Ok(QuoteDto(x));
    }

    [HttpPut("quotations/{id:guid}")]
    [Authorize(Policy = "SalesEdit")]
    public async Task<IActionResult> UpdateQuotation(Guid id, [FromBody] QuoteBody body, CancellationToken ct)
    {
        var x = await db.Quotations.FirstOrDefaultAsync(q => q.Id == id, ct);
        if (x is null) return NotFound();
        x.UpdateHeader(body.Customer ?? x.Customer, body.CustomerEmail, body.CustomerAddress, body.OrderDate ?? x.OrderDate,
            body.ExpiryDate, body.Pricelist ?? x.Pricelist, body.PaymentTerms ?? x.PaymentTerms, body.Salesperson, body.Notes, Actor());
        if (body.Lines is not null) x.SetLines(MapLines(body.Lines), Actor());
        await db.SaveChangesAsync(ct);
        return Ok(QuoteDto(x));
    }

    [HttpPost("quotations/{id:guid}/send")]
    [Authorize(Policy = "SalesEdit")]
    public Task<IActionResult> SendQuotation(Guid id, CancellationToken ct) => QuoteAction(id, q => q.Send(Actor()), ct);

    [HttpPost("quotations/{id:guid}/confirm")]
    [Authorize(Policy = "SalesEdit")]
    public Task<IActionResult> ConfirmQuotation(Guid id, CancellationToken ct) => QuoteAction(id, q => q.Confirm(Actor()), ct);

    [HttpPost("quotations/{id:guid}/cancel")]
    [Authorize(Policy = "SalesEdit")]
    public Task<IActionResult> CancelQuotation(Guid id, CancellationToken ct) => QuoteAction(id, q => q.Cancel(Actor()), ct);

    [HttpPost("quotations/{id:guid}/draft")]
    [Authorize(Policy = "SalesEdit")]
    public Task<IActionResult> DraftQuotation(Guid id, CancellationToken ct) => QuoteAction(id, q => q.SetDraft(Actor()), ct);

    // ───────────────────────────── Dashboard ─────────────────────────────

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var opps = await db.Opportunities.AsNoTracking().ToListAsync(ct);
        var quotes = await db.Quotations.AsNoTracking().ToListAsync(ct);
        var open = opps.Where(o => o.Stage != SalesStage.Won && o.Stage != SalesStage.Lost).ToList();
        var orders = quotes.Where(q => q.Status == QuotationStatus.SalesOrder).ToList();
        return Ok(new
        {
            pipelineValue = open.Sum(o => o.ExpectedRevenue),
            openOpportunities = open.Count,
            wonRevenue = opps.Where(o => o.Stage == SalesStage.Won).Sum(o => o.ExpectedRevenue),
            quotationsOpen = quotes.Count(q => q.Status is QuotationStatus.Quotation or QuotationStatus.Sent),
            quotationsValue = quotes.Where(q => q.Status is QuotationStatus.Quotation or QuotationStatus.Sent).Sum(q => q.Total),
            salesOrders = orders.Count,
            salesOrdersValue = orders.Sum(q => q.Total),
            products = await db.Products.AsNoTracking().CountAsync(ct),
            stageFunnel = Enum.GetValues<SalesStage>().Select(s => new { stage = s.ToString(), count = opps.Count(o => o.Stage == s), value = opps.Where(o => o.Stage == s).Sum(o => o.ExpectedRevenue) }),
            recentQuotes = quotes.OrderByDescending(q => q.CreatedAt).Take(6).Select(QuoteDto),
            topOpportunities = open.OrderByDescending(o => o.ExpectedRevenue).Take(6).Select(OppDto)
        });
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private async Task<IActionResult> QuoteAction(Guid id, Action<Quotation> act, CancellationToken ct)
    {
        var x = await db.Quotations.FirstOrDefaultAsync(q => q.Id == id, ct);
        if (x is null) return NotFound();
        act(x);
        await db.SaveChangesAsync(ct);
        return Ok(QuoteDto(x));
    }

    private static List<QuotationLine> MapLines(IEnumerable<LineBody>? lines) =>
        (lines ?? Enumerable.Empty<LineBody>())
            .Where(l => !string.IsNullOrWhiteSpace(l.Product))
            .Select(l => new QuotationLine
            {
                ProductCode = string.IsNullOrWhiteSpace(l.ProductCode) ? null : l.ProductCode!.Trim(),
                Product = l.Product!.Trim(),
                Description = string.IsNullOrWhiteSpace(l.Description) ? null : l.Description!.Trim(),
                Quantity = l.Quantity <= 0 ? 1 : l.Quantity,
                UnitPrice = l.UnitPrice < 0 ? 0 : l.UnitPrice,
                TaxPercent = l.TaxPercent < 0 ? 0 : l.TaxPercent
            }).ToList();

    private async Task<string> NextOppCodeAsync(CancellationToken ct)
    {
        var codes = await db.Opportunities.AsNoTracking().Select(o => o.Code).ToListAsync(ct);
        var next = codes.Select(c => int.TryParse(c.Replace("OPP-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(1000).Max() + 1;
        return $"OPP-{next}";
    }

    private async Task<string> NextProductCodeAsync(CancellationToken ct)
    {
        var codes = await db.Products.AsNoTracking().Select(p => p.Code).ToListAsync(ct);
        var next = codes.Select(c => int.TryParse(c.Replace("PROD-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(1000).Max() + 1;
        return $"PROD-{next}";
    }

    private async Task<string> NextQuoteNumberAsync(CancellationToken ct)
    {
        var numbers = await db.Quotations.AsNoTracking().Select(q => q.Number).ToListAsync(ct);
        var next = numbers.Select(c => int.TryParse(c.Replace("S", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(0).Max() + 1;
        return $"S{next:00000}";
    }

    private static object OppDto(Opportunity o) => new
    {
        id = o.Id,
        code = o.Code,
        name = o.Name,
        stage = o.Stage.ToString(),
        customer = o.Customer,
        contactName = o.ContactName,
        email = o.Email,
        phone = o.Phone,
        salesperson = o.Salesperson,
        expectedRevenue = o.ExpectedRevenue,
        probability = o.Probability,
        priority = o.Priority,
        expectedClosing = o.ExpectedClosing,
        source = o.Source,
        description = o.Description,
        tags = o.Tags,
        createdAt = o.CreatedAt,
        activities = o.Activities.Select((a, i) => new { index = i, kind = a.Kind, summary = a.Summary, dueDate = a.DueDate, done = a.Done, by = a.By, at = a.At })
    };

    private static object ProductDto(Product p) => new
    {
        id = p.Id,
        code = p.Code,
        name = p.Name,
        category = p.Category,
        unitPrice = p.UnitPrice,
        taxPercent = p.TaxPercent,
        onHand = p.OnHand,
        uom = p.Uom,
        description = p.Description,
        active = p.Active
    };

    private static object QuoteDto(Quotation x) => new
    {
        id = x.Id,
        number = x.Number,
        status = x.Status.ToString(),
        customer = x.Customer,
        customerEmail = x.CustomerEmail,
        customerAddress = x.CustomerAddress,
        orderDate = x.OrderDate,
        expiryDate = x.ExpiryDate,
        pricelist = x.Pricelist,
        paymentTerms = x.PaymentTerms,
        salesperson = x.Salesperson,
        opportunityId = x.OpportunityId,
        notes = x.Notes,
        untaxedAmount = x.UntaxedAmount,
        taxAmount = x.TaxAmount,
        total = x.Total,
        lines = x.Lines.Select(l => new { productCode = l.ProductCode, product = l.Product, description = l.Description, quantity = l.Quantity, unitPrice = l.UnitPrice, taxPercent = l.TaxPercent, subtotal = l.Subtotal, taxAmount = l.TaxAmount })
    };

    public sealed record OppBody(string? Name, string? Customer, string? Stage, decimal? ExpectedRevenue, decimal? Probability,
        int? Priority, string? ContactName, string? Email, string? Phone, string? Salesperson, DateOnly? ExpectedClosing,
        string? Source, string? Description, string[]? Tags);
    public sealed record StageBody(string Stage, string? Note);
    public sealed record ActivityBody(string? Kind, string? Summary, DateOnly? DueDate);
    public sealed record ProductBody(string? Code, string? Name, string? Category, decimal? UnitPrice, decimal? TaxPercent, decimal? OnHand, string? Uom, string? Description, bool? Active);
    public sealed record LineBody(string? ProductCode, string? Product, string? Description, decimal Quantity, decimal UnitPrice, decimal TaxPercent);
    public sealed record QuoteBody(string? Customer, string? CustomerEmail, string? CustomerAddress, DateOnly? OrderDate, DateOnly? ExpiryDate,
        string? Pricelist, string? PaymentTerms, string? Salesperson, Guid? OpportunityId, string? Notes, List<LineBody>? Lines);
}
