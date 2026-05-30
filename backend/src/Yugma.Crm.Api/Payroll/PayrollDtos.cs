namespace Yugma.Crm.Api.Payroll;

// ---------- Monthly register (company month-wise + per-employee) ----------
public sealed record PayrollRegisterDto(
    int Year,
    int Month,
    string Label,
    string Status,
    PayrollSummaryDto Summary,
    IReadOnlyList<DeptCostDto> Departments,
    IReadOnlyList<PayrollRowDto> Rows);

public sealed record PayrollSummaryDto(
    int Employees,
    decimal Gross,
    decimal Net,
    decimal Pf,
    decimal Esi,
    decimal Pt,
    decimal Tds,
    decimal Statutory,
    decimal CtcOutflow,
    decimal AvgNet,
    decimal PrevNet,
    double NetDeltaPct);

public sealed record DeptCostDto(
    string Department,
    int Employees,
    decimal Gross,
    decimal Net);

public sealed record PayrollRowDto(
    Guid EmployeeId,
    string Name,
    string Code,
    string Department,
    string Designation,
    string? AvatarUrl,
    int PaidDays,
    decimal Basic,
    decimal Hra,
    decimal Special,
    decimal Conveyance,
    decimal Bonus,
    decimal Gross,
    decimal Pf,
    decimal Esi,
    decimal Pt,
    decimal Tds,
    decimal OtherDeductions,
    decimal TotalDeductions,
    decimal Net);

// ---------- Yearly summary (company year-wise) ----------
public sealed record PayrollYearDto(
    int Year,
    PayrollYearTotalsDto Totals,
    IReadOnlyList<PayrollMonthDto> Months);

public sealed record PayrollYearTotalsDto(
    decimal Gross,
    decimal Net,
    decimal Statutory,
    decimal Tds,
    int PaidMonths,
    decimal PeakNet);

public sealed record PayrollMonthDto(
    int Month,
    string Label,
    int Employees,
    decimal Gross,
    decimal Net,
    decimal Statutory,
    decimal Tds,
    string Status);
