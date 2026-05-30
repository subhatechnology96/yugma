using Yugma.Crm.Api.Payroll;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/hr/payroll")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class PayrollController(YugmaDbContext db) : ControllerBase
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>Company payroll register for a month: KPI summary, department cost split and a per-employee row for every employee.</summary>
    [HttpGet("register")]
    [ProducesResponseType(typeof(PayrollRegisterDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Register([FromQuery] string? month = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var (year, m) = ParseMonth(month);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        return Ok(PayrollFactory.BuildRegister(employees, year, m, Today, search, await RulesAsync(ct)));
    }

    /// <summary>Company payroll across all 12 months of a year: per-month totals, status and annual roll-up.</summary>
    [HttpGet("year")]
    [ProducesResponseType(typeof(PayrollYearDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Year([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var y = year ?? Today.Year;
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
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

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
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
