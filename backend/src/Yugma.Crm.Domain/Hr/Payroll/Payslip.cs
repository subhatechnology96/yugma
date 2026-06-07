using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Payroll;

/// <summary>
/// One employee's payslip within a payroll run. Earnings and statutory deductions are seeded from the
/// salary structure; HR can then edit LOP days, bonus and ad-hoc earnings/deductions, and Net recomputes.
/// </summary>
public sealed class Payslip : Entity<Guid>, IAggregateRoot
{
    public Guid RunId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string EmployeeName { get; private set; } = default!;
    public string Code { get; private set; } = default!;
    public string Department { get; private set; } = default!;
    public string Designation { get; private set; } = default!;
    public int Year { get; private set; }
    public int Month { get; private set; }

    public int PayableDays { get; private set; }
    public int LopDays { get; private set; }

    // Earnings
    public decimal Basic { get; private set; }
    public decimal Hra { get; private set; }
    public decimal Special { get; private set; }
    public decimal Conveyance { get; private set; }
    public decimal Bonus { get; private set; }
    public decimal OtherEarnings { get; private set; }

    // Deductions
    public decimal Pf { get; private set; }
    public decimal Esi { get; private set; }
    public decimal Pt { get; private set; }
    public decimal Tds { get; private set; }
    public decimal OtherDeductions { get; private set; }

    // Derived (stored for fast reads)
    public decimal LopDeduction { get; private set; }
    public decimal Gross { get; private set; }
    public decimal TotalDeductions { get; private set; }
    public decimal Net { get; private set; }

    public string? Notes { get; private set; }
    public bool Edited { get; private set; }

    private Payslip() { } // EF

    public static Payslip Create(Guid tenantId, Guid runId, Guid employeeId, string name, string code, string department, string designation,
        int year, int month, int payableDays, int lopDays,
        decimal basic, decimal hra, decimal special, decimal conveyance, decimal bonus, decimal otherEarnings,
        decimal pf, decimal esi, decimal pt, decimal tds, decimal otherDeductions, string? createdBy = null)
    {
        var p = new Payslip
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RunId = runId,
            EmployeeId = employeeId,
            EmployeeName = name,
            Code = code,
            Department = department,
            Designation = designation,
            Year = year,
            Month = month,
            PayableDays = payableDays,
            LopDays = Math.Clamp(lopDays, 0, payableDays),
            Basic = basic, Hra = hra, Special = special, Conveyance = conveyance, Bonus = bonus, OtherEarnings = otherEarnings,
            Pf = pf, Esi = esi, Pt = pt, Tds = tds, OtherDeductions = otherDeductions,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        p.Recompute();
        return p;
    }

    /// <summary>Fixed monthly salary used as the per-day base for LOP (excludes one-off bonus/ad-hoc earnings).</summary>
    public decimal FixedMonthly => Basic + Hra + Special + Conveyance;

    /// <summary>HR edits the variable parts of a payslip; the slip then recomputes LOP and Net.</summary>
    public void Edit(int? lopDays, decimal? bonus, decimal? otherEarnings, decimal? otherDeductions, string? notes, string? by)
    {
        if (lopDays is { } l) LopDays = Math.Clamp(l, 0, PayableDays);
        if (bonus is { } b) Bonus = Math.Max(0, b);
        if (otherEarnings is { } oe) OtherEarnings = Math.Max(0, oe);
        if (otherDeductions is { } od) OtherDeductions = Math.Max(0, od);
        if (notes is not null) Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Edited = true;
        Recompute();
        Touch(by);
    }

    /// <summary>Adds to a payslip's bonus or a deduction (used by bulk actions).</summary>
    public void Adjust(decimal bonusDelta, decimal deductionDelta, string? by)
    {
        Bonus = Math.Max(0, Bonus + bonusDelta);
        OtherDeductions = Math.Max(0, OtherDeductions + deductionDelta);
        Edited = true;
        Recompute();
        Touch(by);
    }

    public void SetLopDays(int lopDays, string? by) { LopDays = Math.Clamp(lopDays, 0, PayableDays); Edited = true; Recompute(); Touch(by); }

    private void Recompute()
    {
        var perDay = PayableDays > 0 ? FixedMonthly / PayableDays : 0m;
        LopDeduction = Math.Round(perDay * LopDays, 0);
        Gross = FixedMonthly + Bonus + OtherEarnings;
        TotalDeductions = Pf + Esi + Pt + Tds + LopDeduction + OtherDeductions;
        Net = Gross - TotalDeductions;
    }

    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
