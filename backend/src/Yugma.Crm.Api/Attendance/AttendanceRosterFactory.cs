using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Attendance;

namespace Yugma.Crm.Api.Attendance;

/// <summary>
/// Attendance policy that drives how the roster is computed. Configurable from the board's
/// "Configure" panel; falls back to sensible company defaults.
/// </summary>
public sealed record AttendanceConfig(
    string ShiftStart,
    string ShiftEnd,
    int GraceMinutes,
    double FullDayHours,
    double OvertimeThresholdHours,
    IReadOnlyList<int> WeekendDays) // 0 = Sunday … 6 = Saturday (System.DayOfWeek)
{
    public static AttendanceConfig Default => new("09:00", "18:00", 15, 9.0, 9.0, new[] { 0, 6 });
}

/// <summary>
/// Builds a full, presentation-ready daily attendance roster for the whole company on a given date.
/// Each employee's punch is generated deterministically from (employee id + date) so the board stays
/// stable on refresh, while honouring the supplied <see cref="AttendanceConfig"/> policy.
/// </summary>
public static class AttendanceRosterFactory
{
    public static AttendanceRosterDto Build(
        IReadOnlyList<Employee> employees,
        DateOnly date,
        string? department,
        string? search,
        AttendanceConfig config,
        IReadOnlyDictionary<Guid, AttendanceOverride>? overrides = null,
        IReadOnlyDictionary<Guid, AttendanceRecord>? records = null)
    {
        var isWeekend = config.WeekendDays.Contains((int)date.DayOfWeek);
        var shiftLabel = isWeekend ? "Weekly off" : $"General · {config.ShiftStart}–{config.ShiftEnd}";

        var all = employees
            .OrderBy(e => e.Name.Full)
            .Select(e =>
            {
                AttendanceOverride? ov = null;
                AttendanceRecord? rec = null;
                overrides?.TryGetValue(e.Id, out ov);
                records?.TryGetValue(e.Id, out rec);
                return BuildOne(e, date, config, ov, rec);
            })
            .ToList();

        var summary = Summarise(all, isWeekend);
        var departments = all
            .GroupBy(r => r.Department)
            .OrderBy(g => g.Key)
            .Select(g => DeptSummary(g.Key, g.ToList()))
            .ToList();

        // department + search only narrow the visible table; the KPIs stay company-wide.
        IEnumerable<AttendanceRowDto> rows = all;
        if (!string.IsNullOrWhiteSpace(department))
            rows = rows.Where(r => r.Department.Equals(department, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(r =>
                r.Name.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                r.Code.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                r.Department.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                r.Designation.Contains(s, StringComparison.OrdinalIgnoreCase));
        }
        var visible = rows.ToList();

        return new AttendanceRosterDto(
            date, date.DayOfWeek.ToString(), isWeekend,
            visible.Count, summary, departments, visible);
    }

    /// <summary>
    /// Resolves a single employee's row for one day using the same precedence as the roster:
    /// 1) manual correction, 2) persisted record (weekdays only), 3) generated fallback. Used by the
    /// monthly calendar to build a per-day timeline without materialising the whole company board.
    /// </summary>
    public static AttendanceRowDto BuildOne(
        Employee e, DateOnly date, AttendanceConfig config,
        AttendanceOverride? ov = null, AttendanceRecord? rec = null)
    {
        var isWeekend = config.WeekendDays.Contains((int)date.DayOfWeek);
        var shiftLabel = isWeekend ? "Weekly off" : $"General · {config.ShiftStart}–{config.ShiftEnd}";
        if (ov != null) return ApplyOverride(e, ov, config, shiftLabel, isWeekend);
        if (!isWeekend && rec != null) return RowFromRecord(e, rec, config, shiftLabel);
        return BuildRow(e, date, isWeekend, config, shiftLabel);
    }

    private static AttendanceRowDto BuildRow(Employee e, DateOnly date, bool isWeekend, AttendanceConfig cfg, string shiftLabel)
    {
        if (isWeekend)
            return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
                e.AvatarUrl, shiftLabel, "weekoff", null, null, 0, 0, 0, 0, "—", false);

        var r = Rng(e.Id, date);
        var shiftStartMin = ParseMinutes(cfg.ShiftStart, 9 * 60);

        var roll = r.NextDouble();
        if (roll < 0.04)
            return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
                e.AvatarUrl, shiftLabel, "absent", null, null, 0, 0, 0, 0, "—", false);
        if (roll < 0.10)
            return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
                e.AvatarUrl, shiftLabel, "leave", null, null, 0, 0, 0, 0, "—", false);

        // Working employee: skew arrival toward on-time, occasionally later.
        var offset = (int)Math.Round(Math.Pow(r.NextDouble(), 2.2) * 75); // minutes past shift start
        var inMin = shiftStartMin + offset;
        var lateBy = Math.Max(0, offset - cfg.GraceMinutes);

        var hours = Math.Round(cfg.FullDayHours - 1.0 + r.NextDouble() * 2.2, 1);
        if (hours < 0) hours = 0;
        var outMin = inMin + (int)Math.Round(hours * 60) + 60; // + ~1h break
        var overtime = hours > cfg.OvertimeThresholdHours
            ? (int)Math.Round((hours - cfg.OvertimeThresholdHours) * 60)
            : 0;

        var isWfh = r.NextDouble() < 0.27;
        string status; string location;
        if (isWfh) { status = "wfh"; location = "Remote"; }
        else if (lateBy > 0) { status = "late"; location = e.Location; }
        else { status = "present"; location = e.Location; }

        return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
            e.AvatarUrl, shiftLabel, status, FmtTime(inMin), FmtTime(outMin),
            hours, cfg.FullDayHours, lateBy, overtime, location, false);
    }

    /// <summary>Builds a row from a manual correction, recomputing hours/late/overtime under the current policy.</summary>
    private static AttendanceRowDto ApplyOverride(Employee e, AttendanceOverride ov, AttendanceConfig cfg, string shiftLabel, bool isWeekend)
    {
        var status = ov.Status.ToLowerInvariant();
        var label = isWeekend ? shiftLabel : $"General · {cfg.ShiftStart}–{cfg.ShiftEnd}";

        if (status is "leave" or "absent")
            return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
                e.AvatarUrl, label, status, null, null, 0, 0, 0, 0, "—", true);

        var shiftStartMin = ParseMinutes(cfg.ShiftStart, 9 * 60);
        var inMin = ParseMinutes(ov.InTime ?? cfg.ShiftStart, shiftStartMin);
        var outMin = ParseMinutes(ov.OutTime ?? cfg.ShiftEnd, ParseMinutes(cfg.ShiftEnd, 18 * 60));

        var hours = Math.Max(0, Math.Round((outMin - inMin) / 60.0, 1));
        var lateBy = Math.Max(0, (inMin - shiftStartMin) - cfg.GraceMinutes);
        var overtime = hours > cfg.OvertimeThresholdHours
            ? (int)Math.Round((hours - cfg.OvertimeThresholdHours) * 60)
            : 0;
        var location = status == "wfh" ? "Remote" : e.Location;

        return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
            e.AvatarUrl, label, status, ov.InTime, ov.OutTime,
            hours, cfg.FullDayHours, lateBy, overtime, location, true);
    }

    /// <summary>
    /// Builds a roster row from a PERSISTED attendance record (the facts: punches + base status stored in
    /// Postgres), recomputing the policy-derived fields (late-by, overtime, late vs present) under the
    /// current <see cref="AttendanceConfig"/> so the Configure panel still recomputes live.
    /// </summary>
    private static AttendanceRowDto RowFromRecord(Employee e, AttendanceRecord rec, AttendanceConfig cfg, string shiftLabel)
    {
        if (rec.Status is AttendanceStatus.Leave or AttendanceStatus.Absent)
        {
            var s = rec.Status.ToString().ToLowerInvariant();
            return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
                e.AvatarUrl, shiftLabel, s, null, null, 0, 0, 0, 0, "—", false);
        }

        var shiftStartMin = ParseMinutes(cfg.ShiftStart, 9 * 60);
        var inMin = ParseMinutes(rec.InTime ?? cfg.ShiftStart, shiftStartMin);
        var hours = (double)rec.Hours;
        var lateBy = Math.Max(0, (inMin - shiftStartMin) - cfg.GraceMinutes);
        var overtime = hours > cfg.OvertimeThresholdHours
            ? (int)Math.Round((hours - cfg.OvertimeThresholdHours) * 60)
            : 0;

        var isWfh = rec.Status == AttendanceStatus.Wfh;
        var status = isWfh ? "wfh" : (lateBy > 0 ? "late" : "present");
        var location = isWfh ? "Remote" : e.Location;

        return new AttendanceRowDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation,
            e.AvatarUrl, shiftLabel, status, rec.InTime, rec.OutTime,
            hours, cfg.FullDayHours, lateBy, overtime, location, false);
    }

    private static AttendanceSummaryDto Summarise(IReadOnlyList<AttendanceRowDto> rows, bool isWeekend)
    {
        int total = rows.Count;
        int present = rows.Count(r => r.Status == "present");
        int wfh = rows.Count(r => r.Status == "wfh");
        int late = rows.Count(r => r.Status == "late");
        int leave = rows.Count(r => r.Status == "leave");
        int absent = rows.Count(r => r.Status == "absent");

        int worked = present + wfh + late;
        double totalHours = Math.Round(rows.Sum(r => r.Hours), 1);
        double overtimeHours = Math.Round(rows.Sum(r => r.OvertimeMin) / 60.0, 1);
        double attendanceRate = total == 0 || isWeekend ? 0 : Math.Round((double)worked / total * 100, 1);
        double onTime = (present + late) == 0 ? 100 : Math.Round((double)present / (present + late) * 100, 1);
        double avgHours = worked == 0 ? 0 : Math.Round(totalHours / worked, 1);

        double Pct(int n) => total == 0 ? 0 : Math.Round((double)n / total * 100, 1);

        return new AttendanceSummaryDto(
            total, present, wfh, late, leave, absent,
            Pct(present), Pct(wfh), Pct(late), Pct(leave), Pct(absent),
            attendanceRate, onTime, avgHours, totalHours, overtimeHours);
    }

    private static DeptAttendanceDto DeptSummary(string dept, IReadOnlyList<AttendanceRowDto> rows)
    {
        int total = rows.Count;
        int present = rows.Count(r => r.Status == "present");
        int wfh = rows.Count(r => r.Status == "wfh");
        int late = rows.Count(r => r.Status == "late");
        int leave = rows.Count(r => r.Status == "leave");
        int absent = rows.Count(r => r.Status == "absent");
        double rate = total == 0 ? 0 : Math.Round((double)(present + wfh + late) / total * 100, 1);
        return new DeptAttendanceDto(dept, total, present, wfh, late, leave, absent, rate);
    }

    private static int ParseMinutes(string hhmm, int fallback)
    {
        var parts = (hhmm ?? "").Split(':');
        if (parts.Length == 2 && int.TryParse(parts[0], out var h) && int.TryParse(parts[1], out var m))
            return Math.Clamp(h, 0, 23) * 60 + Math.Clamp(m, 0, 59);
        return fallback;
    }

    private static string FmtTime(int minutes)
    {
        minutes = ((minutes % 1440) + 1440) % 1440;
        return $"{minutes / 60:00}:{minutes % 60:00}";
    }

    private static Random Rng(Guid id, DateOnly date)
    {
        var bytes = id.ToByteArray();
        int h = date.DayNumber;
        foreach (var x in bytes) h = unchecked(h * 31 + x);
        return new Random(h);
    }
}
