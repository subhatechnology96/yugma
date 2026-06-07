using Yugma.Crm.Api.Access;
using Yugma.Crm.Api.Payroll;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr.Leave;
using Yugma.Crm.Domain.Hr.Payroll;
using Yugma.Crm.Domain.Hr.Tax;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/payroll")]
[Produces("application/json")]
[Authorize] // HR/admins see the company register; everyone else sees only their own payslip
public sealed class PayrollController(YugmaDbContext db, HrAccess access, ITenantContext tenant) : ControllerBase
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

    /// <summary>The current user's annual CTC breakup: fixed earnings + employer contributions.</summary>
    [HttpGet("ctc")]
    public async Task<IActionResult> Ctc([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Self is null) return NotFound(new { message = "No employee record is linked to your account." });
        var y = year ?? FyStartYear;
        var rules = await RulesAsync(ct);
        var month = (y == Today.Year) ? Today.Month : 3;
        var slip = PayrollFactory.BuildRegister(new[] { acc.Self }.ToList(), y, month, Today, null, rules).Rows.First();

        decimal A(decimal monthly) => Math.Round(monthly * 12, 0);
        var earnings = new[]
        {
            new { label = "Basic", monthly = slip.Basic, annual = A(slip.Basic) },
            new { label = "House Rent Allowance", monthly = slip.Hra, annual = A(slip.Hra) },
            new { label = "Special allowance", monthly = slip.Special, annual = A(slip.Special) },
            new { label = "Conveyance", monthly = slip.Conveyance, annual = A(slip.Conveyance) }
        };
        var grossA = earnings.Sum(e => e.annual);
        var employerPfA = A(slip.Pf);                                  // employer PF matches employee PF
        var gratuityA = Math.Round(slip.Basic * 12 * 0.0481m, 0);      // 4.81% of basic
        var employer = new[]
        {
            new { label = "Employer PF contribution", annual = employerPfA },
            new { label = "Gratuity", annual = gratuityA }
        };
        return Ok(new
        {
            year = y,
            annualCtc = grossA + employerPfA + gratuityA,
            monthlyGross = slip.Basic + slip.Hra + slip.Special + slip.Conveyance,
            grossEarningsAnnual = grossA,
            earnings,
            employerContributions = employer,
            benefitsAnnual = employerPfA + gratuityA
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

    // ============================ editable pay runs (HR) ============================

    /// <summary>The editable monthly pay runs (HR/admin only).</summary>
    [HttpGet("runs")]
    public async Task<IActionResult> Runs(CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return HrOnly();
        var runs = await db.PayrollRuns.AsNoTracking().Where(r => r.Year > 0)
            .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month).ToListAsync(ct);
        return Ok(runs.Select(RunDto));
    }

    [HttpGet("runs/{id:guid}")]
    public async Task<IActionResult> Run(Guid id, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return HrOnly();
        var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (run is null) return NotFound();
        var slips = await db.Payslips.AsNoTracking().Where(p => p.RunId == id).OrderBy(p => p.EmployeeName).ToListAsync(ct);
        return Ok(new { run = RunDto(run), payslips = slips.Select(SlipDto) });
    }

    /// <summary>Generates (or returns the existing) pay run for a month — one payslip per employee, with LOP pulled from approved unpaid leave.</summary>
    [HttpPost("runs")]
    public async Task<IActionResult> Generate([FromBody] GenerateBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Restricted) return HrOnly();
        var year = body.Year ?? Today.Year;
        var month = body.Month ?? Today.Month;

        var existing = await db.PayrollRuns.FirstOrDefaultAsync(r => r.Year == year && r.Month == month, ct);
        if (existing is not null)
        {
            var slips0 = await db.Payslips.AsNoTracking().Where(p => p.RunId == existing.Id).OrderBy(p => p.EmployeeName).ToListAsync(ct);
            return Ok(new { run = RunDto(existing), payslips = slips0.Select(SlipDto) });
        }

        var rules = await RulesAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        var lop = await LopDaysAsync(year, month, ct);
        var payableDays = DateTime.DaysInMonth(year, month);

        var run = PayrollRun.ForMonth(tenant.TenantId, year, month, $"PAY-{year}-{month:00}", acc.SelfName);
        db.PayrollRuns.Add(run);
        var payslips = employees.Select(e =>
        {
            var bc = PayrollFactory.BaseComponents(e.CtcLakhs, rules);
            return Payslip.Create(tenant.TenantId, run.Id, e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
                year, month, payableDays, lop.GetValueOrDefault(e.Name.Full, 0),
                bc.Basic, bc.Hra, bc.Special, bc.Conveyance, 0m, 0m, bc.Pf, bc.Esi, bc.Pt, bc.Tds, 0m, acc.SelfName);
        }).ToList();
        db.Payslips.AddRange(payslips);
        run.Recalc(payslips.Sum(p => p.Net), payslips.Count, acc.SelfName);
        await db.SaveChangesAsync(ct);
        return Ok(new { run = RunDto(run), payslips = payslips.OrderBy(p => p.EmployeeName).Select(SlipDto) });
    }

    /// <summary>HR edits one employee's payslip (LOP days, bonus, ad-hoc earnings/deductions) — Net recomputes.</summary>
    [HttpPut("runs/{id:guid}/payslips/{pid:guid}")]
    public async Task<IActionResult> EditPayslip(Guid id, Guid pid, [FromBody] EditPayslipBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Restricted) return HrOnly();
        var p = await db.Payslips.FirstOrDefaultAsync(x => x.Id == pid && x.RunId == id, ct);
        if (p is null) return NotFound();
        p.Edit(body.LopDays, body.Bonus, body.OtherEarnings, body.OtherDeductions, body.Notes, acc.SelfName);
        await RecalcRunAsync(id, acc.SelfName, ct);
        await db.SaveChangesAsync(ct);
        return Ok(SlipDto(p));
    }

    /// <summary>Bulk-edit selected (or all) payslips in a run: add a bonus / deduction, or recompute LOP from leave.</summary>
    [HttpPost("runs/{id:guid}/bulk")]
    public async Task<IActionResult> Bulk(Guid id, [FromBody] BulkBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Restricted) return HrOnly();
        var q = db.Payslips.Where(p => p.RunId == id);
        if (body.PayslipIds is { Length: > 0 }) q = q.Where(p => body.PayslipIds.Contains(p.Id));
        var slips = await q.ToListAsync(ct);
        if (slips.Count == 0) return NotFound();
        switch ((body.Action ?? "").ToLowerInvariant())
        {
            case "bonus": foreach (var s in slips) s.Adjust(body.Amount ?? 0, 0, acc.SelfName); break;
            case "deduction": foreach (var s in slips) s.Adjust(0, body.Amount ?? 0, acc.SelfName); break;
            case "recompute-lop":
                var lop = await LopDaysAsync(slips[0].Year, slips[0].Month, ct);
                foreach (var s in slips) s.SetLopDays(lop.GetValueOrDefault(s.EmployeeName, 0), acc.SelfName);
                break;
            default: return BadRequest(new { message = "Unknown bulk action." });
        }
        await RecalcRunAsync(id, acc.SelfName, ct);
        await db.SaveChangesAsync(ct);
        return Ok(new { updated = slips.Count });
    }

    [HttpPost("runs/{id:guid}/status")]
    public async Task<IActionResult> RunStatus(Guid id, [FromBody] RunStatusBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Restricted) return HrOnly();
        if (!Enum.TryParse<PayrollStatus>(body.Status, true, out var s)) return BadRequest(new { message = "Invalid status." });
        var run = await db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (run is null) return NotFound();
        run.SetStatus(s, acc.SelfName);
        await db.SaveChangesAsync(ct);
        return Ok(RunDto(run));
    }

    private async Task RecalcRunAsync(Guid id, string? by, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (run is null) return;
        var slips = await db.Payslips.Where(p => p.RunId == id).ToListAsync(ct);
        run.Recalc(slips.Sum(p => p.Net), slips.Count, by);
    }

    /// <summary>LOP days per employee for a month = overlap of approved Unpaid leave with the month.</summary>
    private async Task<Dictionary<string, int>> LopDaysAsync(int year, int month, CancellationToken ct)
    {
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        var unpaid = await db.LeaveRequests.AsNoTracking()
            .Where(r => r.Status == LeaveStatus.Approved && r.Type == LeaveType.Unpaid && r.FromDate <= monthEnd && r.ToDate >= monthStart)
            .ToListAsync(ct);
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in unpaid)
        {
            var from = r.FromDate > monthStart ? r.FromDate : monthStart;
            var to = r.ToDate < monthEnd ? r.ToDate : monthEnd;
            var days = to.DayNumber - from.DayNumber + 1;
            if (days > 0) map[r.Employee] = map.GetValueOrDefault(r.Employee, 0) + days;
        }
        return map;
    }

    /// <summary>The full, printable payslip document for one employee/run — branded, with the income-tax computation.</summary>
    [HttpGet("runs/{id:guid}/payslips/{pid:guid}/document")]
    public async Task<IActionResult> PayslipDocument(Guid id, Guid pid, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        var p = await db.Payslips.AsNoTracking().FirstOrDefaultAsync(x => x.Id == pid && x.RunId == id, ct);
        if (p is null) return NotFound();
        if (acc.Restricted && acc.SelfId != p.EmployeeId) return HrOnly();   // HR sees anyone; an employee sees only their own

        var emp = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == p.EmployeeId, ct);
        var rules = await RulesAsync(ct);
        var year = p.Year; var month = p.Month;
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = new DateOnly(year, month, DateTime.DaysInMonth(year, month));

        var fixedMonthly = p.Basic + p.Hra + p.Special + p.Conveyance;
        var annual = (emp?.CtcLakhs ?? Math.Round(fixedMonthly * 12 / 100_000m, 2)) * 100_000m;
        var std = rules.StandardDeduction;
        // AnnualTax already includes the H&E cess — split it back out so the payslip shows base tax + cess separately.
        var totalAnnualTax = PayrollFactory.AnnualTax(annual, rules);
        var baseTax = Math.Round(totalAnnualTax / (1m + rules.CessPct), 0);
        var cess = totalAnnualTax - baseTax;
        var taxOnIncome = baseTax;
        var taxPayable = totalAnnualTax;                                   // base tax + cess (= sum of the 12 monthly TDS)
        // financial-year progress (Apr → Mar)
        var fyStart = month >= 4 ? year : year - 1;
        var monthsElapsed = ((year - fyStart) * 12 + month) - 4 + 1;        // 1..12 within the FY
        var deductedSoFar = Math.Round(p.Tds * Math.Max(0, monthsElapsed - 1), 0);
        var balanceTax = Math.Max(0m, taxPayable - p.Tds * monthsElapsed);

        var fyMonths = Enumerable.Range(0, 12).Select(i =>
        {
            var mm = new DateOnly(fyStart, 4, 1).AddMonths(i);
            var amount = (mm.Year == year && mm.Month == month) ? p.Tds
                : (mm.Year < year || (mm.Year == year && mm.Month < month)) ? p.Tds : 0m;
            return new { month = mm.ToString("MMM yy"), amount };
        }).ToList();

        // Use the employee's real statutory/bank details when present; otherwise fall back to stable placeholders.
        var (genPan, genUan, genPf, genBank, genAcct) = StatutoryIds(p.EmployeeId, p.EmployeeName);
        var pan = string.IsNullOrWhiteSpace(emp?.Pan) ? genPan : emp!.Pan!;
        var uan = string.IsNullOrWhiteSpace(emp?.Uan) ? genUan : emp!.Uan!;
        var pfNo = string.IsNullOrWhiteSpace(emp?.PfNumber) ? genPf : emp!.PfNumber!;
        var bank = string.IsNullOrWhiteSpace(emp?.BankName) ? genBank : emp!.BankName!;
        var account = string.IsNullOrWhiteSpace(emp?.BankAccount) ? genAcct : emp!.BankAccount!;

        var setting = await db.PayrollSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var companyName = string.IsNullOrWhiteSpace(setting?.CompanyName) ? "Subha Technology" : setting!.CompanyName;
        var companyLegal = string.IsNullOrWhiteSpace(setting?.CompanyLegalName) ? "Subha Technology Pvt. Ltd." : setting!.CompanyLegalName;

        var earnings = new List<object>
        {
            new { label = "Basic Salary", amount = p.Basic },
            new { label = "HRA", amount = p.Hra },
            new { label = "Conveyance Allowance", amount = p.Conveyance },
            new { label = "Flexible Allowance", amount = p.Special }
        };
        if (p.Bonus > 0) earnings.Add(new { label = "Performance Bonus", amount = p.Bonus });
        if (p.OtherEarnings > 0) earnings.Add(new { label = "Other Earnings", amount = p.OtherEarnings });

        var deductions = new List<object> { new { label = "Ee PF contribution", amount = p.Pf } };
        if (p.Esi > 0) deductions.Add(new { label = "Ee ESI contribution", amount = p.Esi });
        deductions.Add(new { label = "Professional Tax", amount = p.Pt });
        deductions.Add(new { label = "Income Tax", amount = p.Tds });
        if (p.LopDeduction > 0) deductions.Add(new { label = "Loss of Pay", amount = p.LopDeduction });
        if (p.OtherDeductions > 0) deductions.Add(new { label = "Other Deductions", amount = p.OtherDeductions });

        return Ok(new
        {
            company = new { name = companyName, legal = companyLegal, address = setting?.CompanyAddress },
            title = $"Salary Payslip for the Month of {monthStart:MMM}-{year}",
            payPeriod = new { from = monthStart, to = monthEnd, label = $"Pay Period {monthStart:dd.MM.yyyy} to {monthEnd:dd.MM.yyyy}" },
            employee = new
            {
                id = p.Code,
                personId = p.Code,
                name = p.EmployeeName,
                designation = p.Designation,
                department = p.Department,
                band = emp?.Band?.ToString() ?? "—",
                doj = emp?.JoinedAt,
                gender = string.IsNullOrWhiteSpace(emp?.Gender) ? "—" : emp!.Gender!,
                location = emp?.Location ?? "—",
                pan, uan, pfNo, bankName = bank, bankAccount = account,
                daysWorked = p.PayableDays - p.LopDays,
                lwpCurrent = p.LopDays
            },
            standardSalary = new object[]
            {
                new { label = "Basic Salary", amount = p.Basic },
                new { label = "HRA", amount = p.Hra },
                new { label = "Conveyance Allowance", amount = p.Conveyance },
                new { label = "Flexible Allowance", amount = p.Special }
            },
            totalStandard = fixedMonthly,
            earnings,
            grossEarnings = p.Gross,
            deductions,
            grossDeductions = p.TotalDeductions,
            netPay = p.Net,
            tax = new
            {
                taxableTillPrevMonth = p.Gross * Math.Max(0, monthsElapsed - 1),
                currentMonthTaxable = p.Gross,
                projectedStandardSalary = fixedMonthly * 12,
                grossSalary = annual,
                standardDeduction = std,
                incomeUnderHeadSalary = Math.Max(0m, annual - std),
                grossTotalIncome = Math.Max(0m, annual - std),
                totalIncome = Math.Max(0m, annual - std),
                taxOnTotalIncome = taxOnIncome,
                healthEducationCess = cess,
                taxPayable,
                taxDeductedSoFar = deductedSoFar,
                balanceTax
            },
            chapterVI = new object[] { new { label = "Provident Fund", amount = p.Pf * 12 } },
            monthlyTax = fyMonths
        });
    }

    private static (string Pan, string Uan, string PfNo, string Bank, string Account) StatutoryIds(Guid id, string name)
    {
        static long Fnv(string s) { unchecked { long h = 1469598103934665603; foreach (var c in s) { h ^= c; h *= 1099511628211; } return Math.Abs(h); } }
        var seed = Fnv(id.ToString());
        var letters = new string((name.ToUpperInvariant().Where(char.IsLetter).DefaultIfEmpty('X').Take(5)).ToArray()).PadRight(5, 'X');
        var pan = $"{letters}{seed % 9000 + 1000}{(char)('A' + (int)(seed % 26))}";
        var uan = (100000000000 + seed % 899999999999).ToString();
        var pfNo = $"SUBHA/BG/{seed % 9000 + 1000}/{seed % 900000 + 100000}";
        var account = (seed % 900000000000 + 100000000000).ToString();
        return (pan, uan, pfNo, "AXIS BANK LTD", account);
    }

    /// <summary>The signed-in employee's own payslips across processed pay runs (self-service view + download).</summary>
    [HttpGet("my-payslips")]
    public async Task<IActionResult> MyPayslips(CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.SelfId is not Guid eid) return Ok(Array.Empty<object>());
        var slips = await db.Payslips.AsNoTracking().Where(p => p.EmployeeId == eid).ToListAsync(ct);
        if (slips.Count == 0) return Ok(Array.Empty<object>());
        var runIds = slips.Select(s => s.RunId).Distinct().ToList();
        var runs = await db.PayrollRuns.AsNoTracking().Where(r => runIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);
        var rows = slips.OrderByDescending(s => s.Year).ThenByDescending(s => s.Month).Select(s => new
        {
            runId = s.RunId,
            payslipId = s.Id,
            year = s.Year,
            month = s.Month,
            label = MonthName(s.Year, s.Month),
            gross = s.Gross,
            net = s.Net,
            status = runs.TryGetValue(s.RunId, out var r) ? r.Status.ToString().ToLowerInvariant() : "draft"
        });
        return Ok(rows);
    }

    /// <summary>The configurable company branding shown on every payslip.</summary>
    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding(CancellationToken ct)
    {
        var s = await db.PayrollSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return Ok(new
        {
            companyName = string.IsNullOrWhiteSpace(s?.CompanyName) ? "Subha Technology" : s!.CompanyName,
            companyLegalName = string.IsNullOrWhiteSpace(s?.CompanyLegalName) ? "Subha Technology Pvt. Ltd." : s!.CompanyLegalName,
            companyAddress = s?.CompanyAddress
        });
    }

    [HttpPut("branding")]
    public async Task<IActionResult> SetBranding([FromBody] BrandingBody body, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return HrOnly();
        var s = await db.PayrollSettings.FirstOrDefaultAsync(ct);
        if (s is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(body.CompanyName)) s.CompanyName = body.CompanyName.Trim();
        if (!string.IsNullOrWhiteSpace(body.CompanyLegalName)) s.CompanyLegalName = body.CompanyLegalName.Trim();
        s.CompanyAddress = string.IsNullOrWhiteSpace(body.CompanyAddress) ? null : body.CompanyAddress.Trim();
        await db.SaveChangesAsync(ct);
        return Ok(new { companyName = s.CompanyName, companyLegalName = s.CompanyLegalName, companyAddress = s.CompanyAddress });
    }

    public sealed record BrandingBody(string? CompanyName, string? CompanyLegalName, string? CompanyAddress);

    private IActionResult HrOnly() => StatusCode(StatusCodes.Status403Forbidden, new { message = "Payroll runs are available to HR and administrators only." });

    private static string MonthName(int year, int month) => new DateOnly(year, Math.Clamp(month, 1, 12), 1).ToString("MMMM yyyy");

    private static object RunDto(PayrollRun r) => new
    {
        id = r.Id, year = r.Year, month = r.Month, label = MonthName(r.Year, r.Month), cycle = r.Cycle,
        status = r.Status.ToString().ToLowerInvariant(), total = r.Total, employees = r.Employees, runAt = r.RunAt, notes = r.Notes
    };

    private static object SlipDto(Payslip p) => new
    {
        id = p.Id, employeeId = p.EmployeeId, employee = p.EmployeeName, code = p.Code, department = p.Department, designation = p.Designation,
        payableDays = p.PayableDays, lopDays = p.LopDays,
        basic = p.Basic, hra = p.Hra, special = p.Special, conveyance = p.Conveyance, bonus = p.Bonus, otherEarnings = p.OtherEarnings,
        pf = p.Pf, esi = p.Esi, pt = p.Pt, tds = p.Tds, otherDeductions = p.OtherDeductions, lopDeduction = p.LopDeduction,
        gross = p.Gross, totalDeductions = p.TotalDeductions, net = p.Net, edited = p.Edited, notes = p.Notes
    };

    public sealed record GenerateBody(int? Year, int? Month);
    public sealed record EditPayslipBody(int? LopDays, decimal? Bonus, decimal? OtherEarnings, decimal? OtherDeductions, string? Notes);
    public sealed record BulkBody(Guid[]? PayslipIds, string? Action, decimal? Amount);
    public sealed record RunStatusBody(string Status);
}
