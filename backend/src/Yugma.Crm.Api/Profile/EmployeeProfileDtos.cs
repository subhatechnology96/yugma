namespace Yugma.Crm.Api.Profile;

// ---------- Overview ----------
public sealed record EmployeeOverviewDto(
    // Employment
    string Department,
    string Designation,
    string EmploymentType,
    string Manager,
    string Location,
    string Worksite,
    string Grade,
    DateOnly JoinedAt,
    DateOnly ProbationEndsAt,
    DateOnly NextReviewAt,
    double TenureYears,
    // Quick stats
    int Performance,
    double AttendanceRatePct,
    double LeaveAvailableDays,
    decimal LastNetPay,
    // Personal / contact
    string WorkEmail,
    string PersonalEmail,
    string Phone,
    DateOnly DateOfBirth,
    string BloodGroup,
    string MaritalStatus,
    string Address,
    string EmergencyContactName,
    string EmergencyContactRelation,
    string EmergencyContactPhone,
    // Compliance (masked)
    string PanMasked,
    string AadhaarMasked,
    string BankName,
    string BankAccountMasked,
    string Uan,
    // Narrative
    string About,
    IReadOnlyList<string> Skills,
    IReadOnlyList<TimelineEntryDto> Timeline);

public sealed record TimelineEntryDto(DateOnly Date, string Title, string Detail, string Icon);

// ---------- Attendance ----------
public sealed record AttendanceOverviewDto(
    int WorkingDays,
    int Present,
    int Late,
    int Wfh,
    int OnLeave,
    int Absent,
    double AttendanceRatePct,
    double PunctualityPct,
    double AvgHours,
    double TotalHours,
    IReadOnlyList<AttendanceDayDto> Records);

public sealed record AttendanceDayDto(
    DateOnly Date,
    string Day,
    string Status,
    string? InTime,
    string? OutTime,
    double Hours);

// ---------- Leave ----------
public sealed record LeaveOverviewDto(
    double TotalEntitled,
    double TotalUsed,
    double TotalAvailable,
    IReadOnlyList<LeaveBalanceDto> Balances,
    IReadOnlyList<LeaveItemDto> History);

public sealed record LeaveBalanceDto(
    string Type,
    double Entitled,
    double Used,
    double Pending,
    double Available);

public sealed record LeaveItemDto(
    DateOnly From,
    DateOnly To,
    double Days,
    string Type,
    string Status,
    string Reason,
    DateOnly AppliedOn,
    string Approver);

// ---------- Payroll ----------
public sealed record PayrollOverviewDto(
    decimal CtcAnnual,
    decimal MonthlyGross,
    decimal MonthlyNet,
    decimal YtdGross,
    decimal YtdNet,
    decimal YtdTax,
    string Currency,
    PayslipDto Latest,
    IReadOnlyList<PayslipDto> Payslips);

public sealed record PayslipDto(
    string Period,
    DateOnly PayDate,
    string Status,
    int PaidDays,
    // Earnings
    decimal Basic,
    decimal Hra,
    decimal SpecialAllowance,
    decimal Conveyance,
    decimal Bonus,
    decimal GrossEarnings,
    // Deductions
    decimal ProvidentFund,
    decimal ProfessionalTax,
    decimal IncomeTax,
    decimal OtherDeductions,
    decimal TotalDeductions,
    // Net
    decimal NetPay);

// ---------- Documents ----------
public sealed record EmployeeDocumentDto(
    Guid Id,
    string Name,
    string Category,
    string FileType,
    long SizeBytes,
    string Status,
    DateOnly UploadedAt,
    DateOnly? ExpiresAt,
    string? UploadedBy);
