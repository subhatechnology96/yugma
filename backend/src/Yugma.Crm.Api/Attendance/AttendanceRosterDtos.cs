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
