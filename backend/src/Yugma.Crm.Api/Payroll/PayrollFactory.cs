using System.Globalization;
using Yugma.Crm.Domain.Hr;

namespace Yugma.Crm.Api.Payroll;

/// <summary>
/// Computes company payroll deterministically from the real employee roster. A single source of
/// truth for one employee/month slip is aggregated into a monthly register and a yearly summary,
/// so figures stay stable across requests while looking like a populated payroll system.
/// </summary>
public static class PayrollFactory
{
    /// <summary>Salary-structure &amp; statutory rules, loaded from Postgres (payroll_settings + tax_slabs).</summary>
    public sealed record PayrollRules(
        decimal BasicPctOfGross, decimal HraPctOfBasic, decimal Conveyance, decimal PfPctOfBasic,
        decimal ProfessionalTax, decimal EsiGrossThreshold, decimal EsiEmployeePct, decimal EsiEmployerPct,
        decimal StandardDeduction, decimal RebateTaxableLimit, decimal CessPct,
        IReadOnlyList<(decimal UpTo, decimal Rate)> Slabs);

    private sealed record Slip(
        Employee E, int PaidDays, decimal Basic, decimal Hra, decimal Special, decimal Conveyance,
        decimal Bonus, decimal Gross, decimal Pf, decimal EmployerPf, decimal Esi, decimal EsiEmployer,
        decimal Pt, decimal Tds, decimal Other, decimal TotalDeductions, decimal Net);

    // ---------------- monthly register ----------------
    public static PayrollRegisterDto BuildRegister(IReadOnlyList<Employee> employees, int year, int month, DateOnly today, string? search, PayrollRules rules)
    {
        var slips = employees
            .OrderBy(e => e.Name.Full)
            .Select(e => Compute(e, year, month, rules))
            .ToList();

        var summary = Summarise(slips);
        var prevNet = SumNet(employees, AddMonth(year, month, -1), rules);
        var netDelta = prevNet == 0 ? 0 : Math.Round((double)((summary.Net - prevNet) / prevNet) * 100, 1);
        summary = summary with { PrevNet = prevNet, NetDeltaPct = netDelta };

        var departments = slips
            .GroupBy(s => s.E.Department)
            .OrderByDescending(g => g.Sum(s => s.Gross))
            .Select(g => new DeptCostDto(g.Key, g.Count(), Round(g.Sum(s => s.Gross)), Round(g.Sum(s => s.Net))))
            .ToList();

        IEnumerable<Slip> visible = slips;
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            visible = slips.Where(x =>
                x.E.Name.Full.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                x.E.Code.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                x.E.Department.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                x.E.Designation.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        var rows = visible.Select(s => new PayrollRowDto(
            s.E.Id, s.E.Name.Full, s.E.Code, s.E.Department, s.E.Designation, s.E.AvatarUrl,
            s.PaidDays, s.Basic, s.Hra, s.Special, s.Conveyance, s.Bonus, s.Gross,
            s.Pf, s.Esi, s.Pt, s.Tds, s.Other, s.TotalDeductions, s.Net)).ToList();

        return new PayrollRegisterDto(year, month, MonthLabel(year, month), StatusFor(year, month, today), summary, departments, rows);
    }

    // ---------------- yearly summary ----------------
    public static PayrollYearDto BuildYear(IReadOnlyList<Employee> employees, int year, DateOnly today, PayrollRules rules)
    {
        var months = new List<PayrollMonthDto>();
        for (int m = 1; m <= 12; m++)
        {
            var status = StatusFor(year, m, today);
            if (status == "scheduled")
            {
                months.Add(new PayrollMonthDto(m, MonthLabel(year, m), 0, 0, 0, 0, 0, status));
                continue;
            }
            var slips = employees.Select(e => Compute(e, year, m, rules)).ToList();
            months.Add(new PayrollMonthDto(
                m, MonthLabel(year, m), slips.Count,
                Round(slips.Sum(s => s.Gross)), Round(slips.Sum(s => s.Net)),
                Round(slips.Sum(s => s.Pf + s.EmployerPf + s.Esi + s.EsiEmployer + s.Pt)),
                Round(slips.Sum(s => s.Tds)), status));
        }

        var processed = months.Where(m => m.Status != "scheduled").ToList();
        var totals = new PayrollYearTotalsDto(
            Round(processed.Sum(m => m.Gross)),
            Round(processed.Sum(m => m.Net)),
            Round(processed.Sum(m => m.Statutory)),
            Round(processed.Sum(m => m.Tds)),
            processed.Count(m => m.Status == "paid"),
            processed.Count == 0 ? 0 : processed.Max(m => m.Net));

        return new PayrollYearDto(year, totals, months);
    }

    // ---------------- per-employee slip (single source of truth) ----------------
    private static Slip Compute(Employee e, int year, int month, PayrollRules cfg)
    {
        var r = Rng(e.Id, year * 100 + month);
        var annual = e.CtcLakhs * 100_000m;
        var grossMonthly = annual / 12m;

        var basic = Round(grossMonthly * cfg.BasicPctOfGross);
        var hra = Round(basic * cfg.HraPctOfBasic);
        var special = Round(grossMonthly - basic - hra - cfg.Conveyance);
        if (special < 0) special = 0;

        var bonus = month == 4 ? Round(grossMonthly * (0.5m + (decimal)r.NextDouble())) : 0m;
        var other = r.NextDouble() < 0.2 ? Round((decimal)r.Next(500, 3000)) : 0m;

        var gross = basic + hra + special + cfg.Conveyance + bonus;
        var pf = Round(basic * cfg.PfPctOfBasic);
        var employerPf = pf;
        var esi = gross <= cfg.EsiGrossThreshold ? Round(gross * cfg.EsiEmployeePct) : 0m;
        var esiEmployer = gross <= cfg.EsiGrossThreshold ? Round(gross * cfg.EsiEmployerPct) : 0m;
        var pt = cfg.ProfessionalTax;
        var tds = Round(ComputeAnnualTax(annual, cfg) / 12m);

        var totalDed = pf + pt + tds + esi + other;
        var net = gross - totalDed;

        return new Slip(e, DateTime.DaysInMonth(year, month), basic, hra, special, cfg.Conveyance, bonus, gross,
            pf, employerPf, esi, esiEmployer, pt, tds, other, totalDed, net);
    }

    private static PayrollSummaryDto Summarise(IReadOnlyList<Slip> slips)
    {
        var gross = Round(slips.Sum(s => s.Gross));
        var net = Round(slips.Sum(s => s.Net));
        var pf = Round(slips.Sum(s => s.Pf + s.EmployerPf));
        var esi = Round(slips.Sum(s => s.Esi + s.EsiEmployer));
        var pt = Round(slips.Sum(s => s.Pt));
        var tds = Round(slips.Sum(s => s.Tds));
        var statutory = pf + esi + pt;
        var ctcOutflow = gross + Round(slips.Sum(s => s.EmployerPf + s.EsiEmployer));
        var avg = slips.Count == 0 ? 0 : Round(net / slips.Count);
        return new PayrollSummaryDto(slips.Count, gross, net, pf, esi, pt, tds, statutory, ctcOutflow, avg, 0, 0);
    }

    private static decimal SumNet(IReadOnlyList<Employee> employees, (int Year, int Month) ym, PayrollRules rules)
        => Round(employees.Sum(e => Compute(e, ym.Year, ym.Month, rules).Net));

    // ---------------- helpers ----------------
    private static (int Year, int Month) AddMonth(int year, int month, int delta)
    {
        var idx = (year * 12 + (month - 1)) + delta;
        return (idx / 12, idx % 12 + 1);
    }

    private static string StatusFor(int year, int month, DateOnly today)
    {
        var monthStart = new DateOnly(year, month, 1);
        var currentStart = new DateOnly(today.Year, today.Month, 1);
        if (monthStart > currentStart) return "scheduled";
        if (monthStart == currentStart) return "in progress";
        return "paid";
    }

    private static string MonthLabel(int year, int month)
        => new DateOnly(year, month, 1).ToString("MMM yyyy", CultureInfo.InvariantCulture);

    private static decimal ComputeAnnualTax(decimal annualGross, PayrollRules cfg)
    {
        var taxable = annualGross - cfg.StandardDeduction;
        if (taxable <= 0) return 0m;
        if (taxable <= cfg.RebateTaxableLimit) return 0m;

        decimal tax = 0m, lower = 0m;
        foreach (var (upTo, rate) in cfg.Slabs)
        {
            if (taxable > lower) { tax += (Math.Min(taxable, upTo) - lower) * rate; lower = upTo; }
            else break;
        }
        return Round(tax * (1m + cfg.CessPct));
    }

    private static decimal Round(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);

    private static Random Rng(Guid id, int salt)
    {
        var bytes = id.ToByteArray();
        int h = salt;
        foreach (var x in bytes) h = unchecked(h * 31 + x);
        return new Random(h);
    }
}
