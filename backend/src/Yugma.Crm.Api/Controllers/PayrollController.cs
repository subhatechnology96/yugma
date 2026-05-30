using Yugma.Crm.Api.Access;
using Yugma.Crm.Api.Payroll;
using Yugma.Crm.Domain.Hr.Tax;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/hr/payroll")]
[Produces("application/json")]
[Authorize] // HR/admins see the company register; everyone else sees only their own payslip
public sealed class PayrollController(YugmaDbContext db, HrAccess access) : ControllerBase
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static int FyStartYear => Today.Month >= 4 ? Today.Year : Today.Year - 1;

    /// <summary>Company payroll register for a month: KPI summary, department cost split and a per-employee row for every employee.</summary>
    [HttpGet("register")]
    [ProducesResponseType(typeof(PayrollRegisterDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Register([FromQuery] string? month = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var (year, m) = ParseMonth(month);
        var acc = await access.ResolveAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        if (acc.Restricted) employees = employees.Where(e => e.Id == acc.SelfId).ToList();
        return Ok(PayrollFactory.BuildRegister(employees, year, m, Today, search, await RulesAsync(ct)));
    }

    /// <summary>Company payroll across all 12 months of a year: per-month totals, status and annual roll-up.</summary>
    [HttpGet("year")]
    [ProducesResponseType(typeof(PayrollYearDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Year([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var y = year ?? Today.Year;
        var acc = await access.ResolveAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        if (acc.Restricted) employees = employees.Where(e => e.Id == acc.SelfId).ToList();
        return Ok(PayrollFactory.BuildYear(employees, y, Today, await RulesAsync(ct)));
    }

    /// <summary>Loads the salary-structure + statutory rules and tax slabs from Postgres.</summary>
    private async Task<PayrollFactory.PayrollRules> RulesAsync(CancellationToken ct)
    {
        var s = await db.PayrollSettings.AsNoTracking().FirstAsync(ct);
        var slabs = await db.TaxSlabs.AsNoTracking().OrderBy(t => t.SortOrder)
            .Select(t => new { t.UpTo, t.Rate }).ToListAsync(ct);
        return new PayrollFactory.PayrollRules(
            s.BasicPctOfGross, s.HraPctOfBasic, s.Conveyance, s.PfPctOfBasic, s.ProfessionalTax,
            s.EsiGrossThreshold, s.EsiEmployeePct, s.EsiEmployerPct, s.StandardDeduction, s.RebateTaxableLimit, s.CessPct,
            slabs.Select(x => (x.UpTo, x.Rate)).ToList());
    }

    private static (int Year, int Month) ParseMonth(string? month)
    {
        if (!string.IsNullOrWhiteSpace(month))
        {
            var parts = month.Split('-');
            if (parts.Length >= 2 && int.TryParse(parts[0], out var y) && int.TryParse(parts[1], out var m) && m is >= 1 and <= 12)
                return (y, m);
        }
        return (Today.Year, Today.Month);
    }

    // ============================================================
    //  Employee self-service (ESS): declaration, compare-tax, dashboard
    // ============================================================

    private TaxEngine.RegimeParams NewRegimeFrom(PayrollFactory.PayrollRules r) =>
        new("New", r.StandardDeduction, r.RebateTaxableLimit, r.CessPct, r.Slabs);

    /// <summary>The current user's investment-declaration catalog with their saved amounts for a financial year.</summary>
    [HttpGet("declaration")]
    public async Task<IActionResult> GetDeclaration([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.SelfId is null) return NotFound(new { message = "No employee record is linked to your account." });
        var y = year ?? FyStartYear;
        var saved = await db.InvestmentDeclarations.AsNoTracking()
            .Where(d => d.EmployeeId == acc.SelfId && d.Year == y).ToListAsync(ct);
        var map = saved.ToDictionary(d => d.ItemKey, d => d.Amount);

        return Ok(new
        {
            year = y,
            sections = TaxEngine.Catalog.Select(s => new
            {
                code = s.Code,
                label = s.Label,
                limit = s.Limit,
                declared = s.Items.Where(i => !i.Key.EndsWith(".metro")).Sum(i => map.GetValueOrDefault(i.Key, 0m)),
                items = s.Items.Select(i => new { key = i.Key, label = i.Label, amount = map.GetValueOrDefault(i.Key, 0m) })
            })
        });
    }

    public sealed record DeclItemBody(string Key, decimal Amount);
    public sealed record SaveDeclarationBody(int Year, DeclItemBody[] Items);

    /// <summary>Saves the current user's declaration (their own only).</summary>
    [HttpPut("declaration")]
    public async Task<IActionResult> SaveDeclaration([FromBody] SaveDeclarationBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Self is null) return NotFound(new { message = "No employee record is linked to your account." });
        var empId = acc.Self.Id;
        var validKeys = TaxEngine.Catalog.SelectMany(s => s.Items.Select(i => i.Key)).ToHashSet();

        var existing = await db.InvestmentDeclarations
            .Where(d => d.EmployeeId == empId && d.Year == body.Year).ToListAsync(ct);
        var byKey = existing.ToDictionary(d => d.ItemKey);

        foreach (var item in body.Items.Where(i => validKeys.Contains(i.Key)))
        {
            var amt = Math.Max(0, item.Amount);
            if (byKey.TryGetValue(item.Key, out var row)) row.SetAmount(amt, acc.SelfName);
            else db.InvestmentDeclarations.Add(InvestmentDeclaration.Create(acc.Self.TenantId, empId, body.Year, item.Key, amt));
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    /// <summary>Old vs New regime tax for the current user, factoring in their declaration.</summary>
    [HttpGet("compare-tax")]
    public async Task<IActionResult> CompareTax([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Self is null) return NotFound(new { message = "No employee record is linked to your account." });
        var y = year ?? FyStartYear;
        var rules = await RulesAsync(ct);
        var gross = acc.Self.CtcLakhs * 100_000m;
        var basicAnnual = gross * rules.BasicPctOfGross;

        var decl = (await db.InvestmentDeclarations.AsNoTracking()
            .Where(d => d.EmployeeId == acc.SelfId && d.Year == y).ToListAsync(ct))
            .ToDictionary(d => d.ItemKey, d => d.Amount);

        var oldR = TaxEngine.ComputeOld(gross, basicAnnual, TaxEngine.OldRegime(), decl);
        var newR = TaxEngine.ComputeNew(gross, NewRegimeFrom(rules));
        var recommended = newR.Tax <= oldR.Tax ? "New" : "Old";
        return Ok(new { year = y, grossIncome = gross, oldRegime = oldR, newRegime = newR, recommended, saving = Math.Abs(newR.Tax - oldR.Tax) });
    }

    /// <summary>The current user's personal payroll dashboard: salary-vs-tax, CTC breakup, investment utilisation.</summary>
    [HttpGet("me")]
    public async Task<IActionResult> Me([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Self is null) return NotFound(new { message = "No employee record is linked to your account." });
        var y = year ?? FyStartYear;
        var rules = await RulesAsync(ct);
        var single = new[] { acc.Self }.ToList();

        var yr = PayrollFactory.BuildYear(single, y, Today, rules);
        var monthForSlip = (y == Today.Year) ? Today.Month : 3; // current month, or March for a past FY
        var reg = PayrollFactory.BuildRegister(single, y, monthForSlip, Today, null, rules);
        var slip = reg.Rows.FirstOrDefault();

        var decl = (await db.InvestmentDeclarations.AsNoTracking()
            .Where(d => d.EmployeeId == acc.SelfId && d.Year == y).ToListAsync(ct));
        var declaredTotal = decl.Where(d => !d.ItemKey.EndsWith(".metro")).Sum(d => d.Amount);
        decimal capTotal = TaxEngine.Catalog.Where(s => s.Limit.HasValue).Sum(s => s.Limit!.Value);

        return Ok(new
        {
            year = y,
            employee = new { acc.Self.Code, name = acc.Self.Name.Full, department = acc.Self.Department, designation = acc.Self.Designation, ctcAnnual = acc.Self.CtcLakhs * 100_000m },
            slip,
            salaryVsTax = yr.Months.Select(m => new { m.Month, m.Label, net = m.Net, tax = m.Tds, status = m.Status }),
            investmentUtilisation = new { declared = declaredTotal, limit = capTotal, remaining = Math.Max(0, capTotal - declaredTotal) },
            annualTax = yr.Totals.Tds,
            paidDays = yr.Months.Where(m => m.Status != "scheduled").Select(m => new { m.Month, m.Label, days = DateTime.DaysInMonth(m.Month >= 4 ? y : y + 1, m.Month) })
        });
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        // Company-wide payroll runs are HR/admin only.
        if ((await access.ResolveAsync(ct)).Restricted) return Ok(Array.Empty<object>());
        var rows = await db.PayrollRuns.AsNoTracking()
            .OrderByDescending(p => p.RunAt)
            .Select(p => new
            {
                cycle = p.Cycle,
                total = p.Total,
                employees = p.Employees,
                status = p.Status.ToString().ToLowerInvariant(),
                runAt = p.RunAt
            })
            .ToListAsync(ct);
        return Ok(rows);
    }
}
