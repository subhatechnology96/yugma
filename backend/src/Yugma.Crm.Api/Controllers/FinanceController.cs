using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Finance;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/finance")]
[Produces("application/json")]
[Authorize(Policy = "FinanceView")]
public sealed class FinanceController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
    private string Actor() => User.Identity?.Name ?? tenant.UserName ?? "Finance";
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    // ============================ DASHBOARD ============================

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var docs = await db.FinanceDocuments.AsNoTracking().ToListAsync(ct);
        var accounts = await db.BankAccounts.AsNoTracking().ToListAsync(ct);
        var txns = await db.BankTransactions.AsNoTracking().ToListAsync(ct);

        object DocSummary(FinanceDocKind kind)
        {
            var set = docs.Where(d => d.Kind == kind && d.Status != FinanceDocStatus.Cancelled).ToList();
            var draft = set.Where(d => d.Status == FinanceDocStatus.Draft).ToList();
            var unpaid = set.Where(d => d.Status == FinanceDocStatus.Posted && d.AmountDue > 0).ToList();
            var late = unpaid.Where(d => d.DueDate < Today).ToList();
            return new
            {
                toValidate = new { count = draft.Count, amount = draft.Sum(d => d.Total) },
                unpaid = new { count = unpaid.Count, amount = unpaid.Sum(d => d.AmountDue) },
                late = new { count = late.Count, amount = late.Sum(d => d.AmountDue) },
                total = unpaid.Sum(d => d.AmountDue),
                aging = Aging(unpaid)
            };
        }

        object AccountCard(BankAccountKind kind)
        {
            var acc = accounts.FirstOrDefault(a => a.Kind == kind);
            if (acc is null) return new { name = kind.ToString(), balance = 0m, lastStatement = 0m, payments = 0m, miscOperations = 0m, toReconcile = 0, trend = Array.Empty<decimal>() };
            var lines = txns.Where(t => t.AccountId == acc.Id).OrderBy(t => t.Date).ToList();
            var balance = acc.OpeningBalance + lines.Sum(t => t.Amount);
            var lastStatement = acc.OpeningBalance + lines.Where(t => t.Reconciled).Sum(t => t.Amount);
            // running-balance series for the sparkline
            var run = acc.OpeningBalance;
            var trend = new List<decimal> { run };
            foreach (var t in lines) { run += t.Amount; trend.Add(run); }
            return new
            {
                name = acc.Name,
                balance,
                lastStatement,
                payments = lines.Where(t => t.Category == "payment").Sum(t => t.Amount),
                miscOperations = lines.Where(t => t.Category == "misc").Sum(t => t.Amount),
                toReconcile = lines.Count(t => !t.Reconciled),
                transactions = lines.Count,
                trend
            };
        }

        return Ok(new
        {
            currency = "₹",
            customerInvoices = DocSummary(FinanceDocKind.CustomerInvoice),
            vendorBills = DocSummary(FinanceDocKind.VendorBill),
            bank = AccountCard(BankAccountKind.Bank),
            cash = AccountCard(BankAccountKind.Cash)
        });
    }

    private static object[] Aging(List<FinanceDocument> unpaid)
    {
        var buckets = new (string Label, Func<int, bool> Test)[]
        {
            ("Overdue", d => d < 0),
            ("This week", d => d is >= 0 and <= 7),
            ("1–4 weeks", d => d is > 7 and <= 30),
            ("1–2 months", d => d is > 30 and <= 60),
            ("Later", d => d > 60)
        };
        return buckets.Select(b => new
        {
            label = b.Label,
            amount = unpaid.Where(d => b.Test(d.DueDate.DayNumber - Today.DayNumber)).Sum(d => d.AmountDue)
        }).Cast<object>().ToArray();
    }

    // ============================ INVOICES / BILLS ============================

    [HttpGet("documents")]
    public async Task<IActionResult> Documents([FromQuery] string? kind = null, [FromQuery] string? status = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.FinanceDocuments.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(kind) && Enum.TryParse<FinanceDocKind>(kind, true, out var k)) q = q.Where(d => d.Kind == k);
        if (!string.IsNullOrWhiteSpace(status) && status != "late" && Enum.TryParse<FinanceDocStatus>(status, true, out var s)) q = q.Where(d => d.Status == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var t = search.Trim();
            q = q.Where(d => EF.Functions.ILike(d.Partner, $"%{t}%") || EF.Functions.ILike(d.Number, $"%{t}%"));
        }
        var rows = await q.OrderByDescending(d => d.IssueDate).ThenByDescending(d => d.CreatedAt).ToListAsync(ct);
        if (status == "late") rows = rows.Where(d => d.Status == FinanceDocStatus.Posted && d.AmountDue > 0 && d.DueDate < Today).ToList();
        return Ok(rows.Select(ToDto));
    }

    [HttpGet("documents/{id:guid}")]
    public async Task<IActionResult> GetDocument(Guid id, CancellationToken ct)
    {
        var d = await db.FinanceDocuments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return d is null ? NotFound() : Ok(ToDto(d));
    }

    [HttpPost("documents")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> CreateDocument([FromBody] DocBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Partner)) return BadRequest(new { message = "Partner is required." });
        var kind = Enum.TryParse<FinanceDocKind>(body.Kind, true, out var k) ? k : FinanceDocKind.CustomerInvoice;
        var status = Enum.TryParse<FinanceDocStatus>(body.Status, true, out var s) ? s : FinanceDocStatus.Draft;
        var issue = body.IssueDate ?? Today;
        var due = body.DueDate ?? issue.AddDays(30);
        var number = await NextNumberAsync(kind, ct);
        var d = FinanceDocument.Create(tenant.TenantId, number, kind, body.Partner!, issue, due,
            body.Amount, body.TaxAmount ?? Math.Round(body.Amount * 0.18m, 2), status, body.AmountPaid ?? 0, body.Reference, body.Notes, Actor());
        db.FinanceDocuments.Add(d);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(d));
    }

    [HttpPut("documents/{id:guid}")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> UpdateDocument(Guid id, [FromBody] DocBody body, CancellationToken ct)
    {
        var d = await db.FinanceDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        d.UpdateDetails(body.Partner ?? d.Partner, body.IssueDate ?? d.IssueDate, body.DueDate ?? d.DueDate,
            body.Amount, body.TaxAmount ?? d.TaxAmount, body.Reference, body.Notes, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(d));
    }

    [HttpPost("documents/{id:guid}/validate")]
    [Authorize(Policy = "FinanceEdit")]
    public Task<IActionResult> Validate(Guid id, CancellationToken ct) => DocAction(id, d => d.Validate(Actor()), ct);

    [HttpPost("documents/{id:guid}/cancel")]
    [Authorize(Policy = "FinanceEdit")]
    public Task<IActionResult> CancelDoc(Guid id, CancellationToken ct) => DocAction(id, d => d.Cancel(Actor()), ct);

    [HttpPost("documents/{id:guid}/pay")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> Pay(Guid id, [FromBody] PayBody body, CancellationToken ct)
    {
        var d = await db.FinanceDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        var amount = body.Amount is > 0 ? body.Amount!.Value : d.AmountDue;
        d.RegisterPayment(amount, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(d));
    }

    private async Task<IActionResult> DocAction(Guid id, Action<FinanceDocument> apply, CancellationToken ct)
    {
        var d = await db.FinanceDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null) return NotFound();
        apply(d);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(d));
    }

    // ============================ EXPENSES ============================

    [HttpGet("expenses")]
    public async Task<IActionResult> Expenses([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = db.Expenses.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ExpenseStatus>(status, true, out var s)) q = q.Where(e => e.Status == s);
        var rows = await q.OrderByDescending(e => e.Date).ThenByDescending(e => e.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(ToExpenseDto));
    }

    [HttpPost("expenses")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> CreateExpense([FromBody] ExpenseBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Employee) || body.Amount <= 0)
            return BadRequest(new { message = "Employee and a positive amount are required." });
        var status = Enum.TryParse<ExpenseStatus>(body.Status, true, out var s) ? s : ExpenseStatus.Submitted;
        var e = Expense.Create(tenant.TenantId, await NextExpenseNumberAsync(ct), body.Employee!, body.Category ?? "Other",
            body.Description ?? body.Category ?? "Expense", body.Date ?? Today, body.Amount, status, Actor());
        db.Expenses.Add(e);
        await db.SaveChangesAsync(ct);
        return Ok(ToExpenseDto(e));
    }

    [HttpPost("expenses/{id:guid}/{action}")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> ExpenseAction(Guid id, string action, [FromBody] NoteBody? body, CancellationToken ct)
    {
        var e = await db.Expenses.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return NotFound();
        switch (action.ToLowerInvariant())
        {
            case "submit": e.Submit(Actor()); break;
            case "approve": e.Approve(Actor()); break;
            case "reimburse": e.Reimburse(Actor()); break;
            case "refuse": e.Refuse(Actor(), body?.Note); break;
            default: return BadRequest(new { message = "Unknown action." });
        }
        await db.SaveChangesAsync(ct);
        return Ok(ToExpenseDto(e));
    }

    // ============================ BANK / CASH ============================

    [HttpGet("bank")]
    public async Task<IActionResult> Bank(CancellationToken ct)
    {
        var accounts = await db.BankAccounts.AsNoTracking().ToListAsync(ct);
        var txns = await db.BankTransactions.AsNoTracking().OrderByDescending(t => t.Date).ToListAsync(ct);
        var result = accounts.Select(a =>
        {
            var lines = txns.Where(t => t.AccountId == a.Id).ToList();
            return new
            {
                id = a.Id,
                name = a.Name,
                kind = a.Kind.ToString(),
                currency = a.Currency,
                balance = a.OpeningBalance + lines.Sum(t => t.Amount),
                toReconcile = lines.Count(t => !t.Reconciled),
                transactions = lines.OrderByDescending(t => t.Date).Take(40).Select(t => new
                {
                    id = t.Id, date = t.Date, label = t.Label, amount = t.Amount, category = t.Category, reconciled = t.Reconciled
                })
            };
        });
        return Ok(result);
    }

    [HttpPost("bank/transactions/{id:guid}/reconcile")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> Reconcile(Guid id, CancellationToken ct)
    {
        var t = await db.BankTransactions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        t.Reconcile(Actor());
        await db.SaveChangesAsync(ct);
        return Ok(new { id = t.Id, reconciled = t.Reconciled });
    }

    // ============================ DOCUMENTS / SIGN ============================

    [HttpGet("files")]
    public async Task<IActionResult> Files([FromQuery] string? signature = null, CancellationToken ct = default)
    {
        var q = db.FinanceFiles.AsNoTracking();
        if (string.Equals(signature, "sign", StringComparison.OrdinalIgnoreCase))
            q = q.Where(f => f.SignatureStatus != SignatureStatus.None);
        var rows = await q.OrderByDescending(f => f.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(ToFileDto));
    }

    [HttpPost("files")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> CreateFile([FromBody] FileBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { message = "Name is required." });
        var f = FinanceFile.Create(tenant.TenantId, body.Name!, body.Category ?? "Document", body.Owner ?? Actor(), SignatureStatus.None, null, null, Actor());
        db.FinanceFiles.Add(f);
        await db.SaveChangesAsync(ct);
        return Ok(ToFileDto(f));
    }

    [HttpPost("files/{id:guid}/request-signature")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> RequestSignature(Guid id, [FromBody] SignBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Signer)) return BadRequest(new { message = "Signer is required." });
        var f = await db.FinanceFiles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (f is null) return NotFound();
        f.RequestSignature(body.Signer!, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ToFileDto(f));
    }

    [HttpPost("files/{id:guid}/sign")]
    [Authorize(Policy = "FinanceEdit")]
    public async Task<IActionResult> Sign(Guid id, CancellationToken ct)
    {
        var f = await db.FinanceFiles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (f is null) return NotFound();
        f.MarkSigned(Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ToFileDto(f));
    }

    // ============================ ANALYTICS (Spreadsheet / BI) ============================

    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(CancellationToken ct)
    {
        var docs = await db.FinanceDocuments.AsNoTracking().Where(d => d.Status != FinanceDocStatus.Cancelled).ToListAsync(ct);
        var expenses = await db.Expenses.AsNoTracking().Where(e => e.Status != ExpenseStatus.Refused).ToListAsync(ct);

        var months = Enumerable.Range(0, 6).Select(i => Today.AddMonths(-5 + i)).Select(d => new DateOnly(d.Year, d.Month, 1)).ToList();
        var revenue = months.Select(m => new
        {
            month = m.ToString("MMM"),
            income = docs.Where(d => d.Kind == FinanceDocKind.CustomerInvoice && d.IssueDate.Year == m.Year && d.IssueDate.Month == m.Month).Sum(d => d.Total),
            spend = docs.Where(d => d.Kind == FinanceDocKind.VendorBill && d.IssueDate.Year == m.Year && d.IssueDate.Month == m.Month).Sum(d => d.Total)
        });

        var expenseByCategory = expenses.GroupBy(e => e.Category)
            .Select(g => new { category = g.Key, amount = g.Sum(x => x.Amount) }).OrderByDescending(x => x.amount);

        var topCustomers = docs.Where(d => d.Kind == FinanceDocKind.CustomerInvoice)
            .GroupBy(d => d.Partner).Select(g => new { partner = g.Key, total = g.Sum(d => d.Total), paid = g.Sum(d => d.AmountPaid) })
            .OrderByDescending(x => x.total).Take(6);

        var receivable = docs.Where(d => d.Kind == FinanceDocKind.CustomerInvoice && d.Status == FinanceDocStatus.Posted).Sum(d => d.AmountDue);
        var payable = docs.Where(d => d.Kind == FinanceDocKind.VendorBill && d.Status == FinanceDocStatus.Posted).Sum(d => d.AmountDue);
        var incomeYtd = docs.Where(d => d.Kind == FinanceDocKind.CustomerInvoice).Sum(d => d.Total);
        var spendYtd = docs.Where(d => d.Kind == FinanceDocKind.VendorBill).Sum(d => d.Total) + expenses.Sum(e => e.Amount);

        return Ok(new
        {
            currency = "₹",
            kpis = new { income = incomeYtd, spend = spendYtd, profit = incomeYtd - spendYtd, receivable, payable, expenses = expenses.Sum(e => e.Amount) },
            revenue,
            expenseByCategory,
            topCustomers
        });
    }

    // ============================ helpers ============================

    private async Task<string> NextNumberAsync(FinanceDocKind kind, CancellationToken ct)
    {
        var prefix = kind == FinanceDocKind.CustomerInvoice ? "INV" : "BILL";
        var nums = await db.FinanceDocuments.AsNoTracking().Where(d => d.Kind == kind).Select(d => d.Number).ToListAsync(ct);
        var next = nums.Select(c => int.TryParse(c.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(1000).Max() + 1;
        return $"{prefix}-{next}";
    }

    private async Task<string> NextExpenseNumberAsync(CancellationToken ct)
    {
        var nums = await db.Expenses.AsNoTracking().Select(e => e.Number).ToListAsync(ct);
        var next = nums.Select(c => int.TryParse(c.Split('-').Last(), out var n) ? n : 0).DefaultIfEmpty(1000).Max() + 1;
        return $"EXP-{next}";
    }

    private static object ToDto(FinanceDocument d) => new
    {
        id = d.Id,
        number = d.Number,
        kind = d.Kind.ToString(),
        status = d.Status.ToString().ToLowerInvariant(),
        late = d.Status == FinanceDocStatus.Posted && d.AmountDue > 0 && d.DueDate < Today,
        partner = d.Partner,
        reference = d.Reference,
        issueDate = d.IssueDate,
        dueDate = d.DueDate,
        amount = d.Amount,
        taxAmount = d.TaxAmount,
        total = d.Total,
        amountPaid = d.AmountPaid,
        amountDue = d.AmountDue,
        notes = d.Notes,
        createdAt = d.CreatedAt
    };

    private static object ToExpenseDto(Expense e) => new
    {
        id = e.Id, number = e.Number, employee = e.Employee, category = e.Category, description = e.Description,
        date = e.Date, amount = e.Amount, status = e.Status.ToString().ToLowerInvariant(), notes = e.Notes
    };

    private static object ToFileDto(FinanceFile f) => new
    {
        id = f.Id, name = f.Name, category = f.Category, owner = f.Owner,
        signatureStatus = f.SignatureStatus.ToString().ToLowerInvariant(), signer = f.Signer, signedAt = f.SignedAt, createdAt = f.CreatedAt
    };

    public sealed record DocBody(string? Kind, string? Status, string? Partner, string? Reference, DateOnly? IssueDate, DateOnly? DueDate, decimal Amount, decimal? TaxAmount, decimal? AmountPaid, string? Notes);
    public sealed record PayBody(decimal? Amount);
    public sealed record ExpenseBody(string? Employee, string? Category, string? Description, DateOnly? Date, decimal Amount, string? Status);
    public sealed record NoteBody(string? Note);
    public sealed record FileBody(string? Name, string? Category, string? Owner);
    public sealed record SignBody(string? Signer);
}
