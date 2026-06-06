namespace Yugma.Crm.Api.Attendance;

public sealed record AttendanceRosterDto(
    DateOnly Date,
    string DayName,
    bool IsWeekend,
    int ShowingCount,
    AttendanceSummaryDto Summary,
    IReadOnlyList<DeptAttendanceDto> Departments,
    IReadOnlyList<AttendanceRowDto> Rows);

public sealed record AttendanceSummaryDto(
    int Total,
    int Present,
    int Wfh,
    int Late,
    int OnLeave,
    int Absent,
    double PresentPct,
    double WfhPct,
    double LatePct,
    double LeavePct,
    double AbsentPct,
    double AttendanceRatePct,
    double OnTimePct,
    double AvgHours,
    double TotalHours,
    double OvertimeHours);

public sealed record DeptAttendanceDto(
    string Department,
    int Total,
    int Present,
    int Wfh,
    int Late,
    int OnLeave,
    int Absent,
    double AttendanceRatePct);

public sealed record AttendanceRowDto(
    Guid EmployeeId,
    string Name,
    string Code,
    string Department,
    string Designation,
    string? AvatarUrl,
    string Shift,
    string Status,
    string? InTime,
    string? OutTime,
    double Hours,
    double ExpectedHours,
    int LateByMin,
    int OvertimeMin,
    string Location,
    bool IsManual);

// ---- monthly calendar ----

public sealed record AttendanceMonthDto(
    int Year,
    int Month,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    string Designation,
    string? AvatarUrl,
    AttendanceMonthSummaryDto Summary,
    IReadOnlyList<AttendanceDayDto> Days,
    IReadOnlyList<AttendanceEmployeeRefDto> SelectableEmployees,
    IReadOnlyList<AttendanceCorrectionDto> Corrections);

public sealed record AttendanceMonthSummaryDto(
    int Present,
    int Wfh,
    int Late,
    int OnLeave,
    int Absent,
    int WeekOff,
    int WorkingDays,
    int Worked,
    double AttendanceRatePct,
    double OnTimePct,
    double TotalHours,
    double AvgHours,
    double OvertimeHours);

public sealed record AttendanceDayDto(
    DateOnly Date,
    int Day,
    int Weekday,           // 0 = Sunday … 6 = Saturday
    bool IsWeekend,
    string Status,         // present | wfh | late | leave | absent | weekoff | upcoming
    string? InTime,
    string? OutTime,
    double Hours,
    int LateByMin,
    int OvertimeMin,
    string Location,
    bool IsManual);

public sealed record AttendanceEmployeeRefDto(
    Guid EmployeeId,
    string Name,
    string Code,
    string Department,
    string Designation,
    string? AvatarUrl);

public sealed record AttendanceCorrectionDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly Date,
    string RequestedStatus,
    string? RequestedInTime,
    string? RequestedOutTime,
    string Reason,
    string Status,            // pending | approved | rejected | cancelled
    string? Approver,
    DateTime RequestedAt,
    DateTime? DecidedAt,
    string? DecidedBy,
    string? DecisionNote);
