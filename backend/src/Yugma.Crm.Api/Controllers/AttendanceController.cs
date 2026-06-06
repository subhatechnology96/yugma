using Yugma.Crm.Api.Access;
using Yugma.Crm.Api.Attendance;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Attendance;
using Yugma.Crm.Domain.Notifications;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/attendance")]
[Produces("application/json")]
[Authorize] // HR/admins see the whole board; everyone else sees only their own attendance
public sealed class AttendanceController(YugmaDbContext db, HrAccess access) : ControllerBase
{
    /// <summary>
    /// Company-wide daily attendance board for a date: KPI summary, department breakdown and the full
    /// employee roster with punches, late-by, overtime, shift and location.
    /// </summary>
    [HttpGet("daily")]
    [ProducesResponseType(typeof(AttendanceRosterDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Daily(
        [FromQuery] DateOnly? date = null,
        [FromQuery] string? department = null,
        [FromQuery] string? search = null,
        [FromQuery] string? shiftStart = null,
        [FromQuery] string? shiftEnd = null,
        [FromQuery] int? graceMinutes = null,
        [FromQuery] double? fullDayHours = null,
        [FromQuery] double? overtimeThresholdHours = null,
        [FromQuery] string? weekendDays = null,
        CancellationToken ct = default)
    {
        var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var d = AttendanceConfig.Default;
        var weekend = ParseWeekendDays(weekendDays) ?? d.WeekendDays;
        var config = new AttendanceConfig(
            string.IsNullOrWhiteSpace(shiftStart) ? d.ShiftStart : shiftStart,
            string.IsNullOrWhiteSpace(shiftEnd) ? d.ShiftEnd : shiftEnd,
            graceMinutes ?? d.GraceMinutes,
            fullDayHours ?? d.FullDayHours,
            overtimeThresholdHours ?? d.OvertimeThresholdHours,
            weekend);

        var acc = await access.ResolveAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        // HR/admins see all; team leads see their team; everyone else sees only themselves.
        if (acc.VisibleIds is { } vis) employees = employees.Where(e => vis.Contains(e.Id)).ToList();

        var overrides = await db.AttendanceOverrides.AsNoTracking()
            .Where(o => o.Date == day)
            .ToListAsync(ct);
        var overrideMap = overrides.ToDictionary(o => o.EmployeeId);

        // Persisted facts for the day (materialised in Postgres); the factory recomputes policy-derived fields.
        var records = await db.AttendanceRecords.AsNoTracking()
            .Where(r => r.Date == day && r.EmployeeId != Guid.Empty)
            .ToListAsync(ct);
        var recordMap = records
            .GroupBy(r => r.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        return Ok(AttendanceRosterFactory.Build(employees, day, department, search, config, overrideMap, recordMap));
    }

    /// <summary>
    /// One employee's attendance for a whole month as a per-day timeline, for the calendar view.
    /// Defaults to the caller (self); HR/admins and team leads may request a visible employee via
    /// <paramref name="employeeId"/>. Future days are returned as "upcoming". Honours the same policy
    /// query params as <see cref="Daily"/>.
    /// </summary>
    [HttpGet("month")]
    [ProducesResponseType(typeof(AttendanceMonthDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Month(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] string? shiftStart = null,
        [FromQuery] string? shiftEnd = null,
        [FromQuery] int? graceMinutes = null,
        [FromQuery] double? fullDayHours = null,
        [FromQuery] double? overtimeThresholdHours = null,
        [FromQuery] string? weekendDays = null,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var y = year is >= 2000 and <= 2100 ? year.Value : today.Year;
        var m = month is >= 1 and <= 12 ? month.Value : today.Month;

        var def = AttendanceConfig.Default;
        var weekend = ParseWeekendDays(weekendDays) ?? def.WeekendDays;
        var config = new AttendanceConfig(
            string.IsNullOrWhiteSpace(shiftStart) ? def.ShiftStart : shiftStart,
            string.IsNullOrWhiteSpace(shiftEnd) ? def.ShiftEnd : shiftEnd,
            graceMinutes ?? def.GraceMinutes,
            fullDayHours ?? def.FullDayHours,
            overtimeThresholdHours ?? def.OvertimeThresholdHours,
            weekend);

        var acc = await access.ResolveAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        if (acc.VisibleIds is { } vis) employees = employees.Where(e => vis.Contains(e.Id)).ToList();
        if (employees.Count == 0)
            return NotFound(new { message = "No employee record is linked to your account." });

        // Target: requested employee (if visible) → self → first visible.
        var target =
            (employeeId is Guid reqId ? employees.FirstOrDefault(e => e.Id == reqId) : null)
            ?? (acc.SelfId is Guid selfId ? employees.FirstOrDefault(e => e.Id == selfId) : null)
            ?? employees.OrderBy(e => e.Name.Full).First();

        var daysInMonth = DateTime.DaysInMonth(y, m);
        var first = new DateOnly(y, m, 1);
        var last = new DateOnly(y, m, daysInMonth);

        var ovMap = (await db.AttendanceOverrides.AsNoTracking()
                .Where(o => o.EmployeeId == target.Id && o.Date >= first && o.Date <= last).ToListAsync(ct))
            .ToDictionary(o => o.Date);
        var recMap = (await db.AttendanceRecords.AsNoTracking()
                .Where(r => r.EmployeeId == target.Id && r.Date >= first && r.Date <= last).ToListAsync(ct))
            .GroupBy(r => r.Date).ToDictionary(g => g.Key, g => g.First());

        var days = new List<AttendanceDayDto>(daysInMonth);
        for (var dayNum = 1; dayNum <= daysInMonth; dayNum++)
        {
            var date = new DateOnly(y, m, dayNum);
            var isWeekend = config.WeekendDays.Contains((int)date.DayOfWeek);
            if (date > today)
            {
                // Don't fabricate punches for the future — show the day as upcoming.
                days.Add(new AttendanceDayDto(date, dayNum, (int)date.DayOfWeek, isWeekend,
                    "upcoming", null, null, 0, 0, 0, "—", false));
                continue;
            }
            ovMap.TryGetValue(date, out var ov);
            recMap.TryGetValue(date, out var rec);
            var row = AttendanceRosterFactory.BuildOne(target, date, config, ov, rec);
            days.Add(new AttendanceDayDto(date, dayNum, (int)date.DayOfWeek, isWeekend,
                row.Status, row.InTime, row.OutTime, row.Hours, row.LateByMin, row.OvertimeMin, row.Location, row.IsManual));
        }

        var selectable = (acc.CanManage || acc.IsTeamLead)
            ? employees.OrderBy(e => e.Name.Full)
                .Select(e => new AttendanceEmployeeRefDto(e.Id, e.Name.Full, e.Code, e.Department, e.Designation, e.AvatarUrl))
                .ToList()
            : new List<AttendanceEmployeeRefDto>();

        var corrections = (await db.AttendanceCorrections.AsNoTracking()
                .Where(c => c.EmployeeId == target.Id && c.Date >= first && c.Date <= last)
                .OrderByDescending(c => c.RequestedAt).ToListAsync(ct))
            .Select(ToCorrectionDto).ToList();

        return Ok(new AttendanceMonthDto(
            y, m, target.Id, target.Name.Full, target.Code, target.Department, target.Designation, target.AvatarUrl,
            SummariseMonth(days), days, selectable, corrections));
    }

    private static AttendanceMonthSummaryDto SummariseMonth(IReadOnlyList<AttendanceDayDto> days)
    {
        var actual = days.Where(d => d.Status != "upcoming").ToList();
        int present = actual.Count(d => d.Status == "present");
        int wfh = actual.Count(d => d.Status == "wfh");
        int late = actual.Count(d => d.Status == "late");
        int leave = actual.Count(d => d.Status == "leave");
        int absent = actual.Count(d => d.Status == "absent");
        int weekoff = actual.Count(d => d.Status == "weekoff");
        int worked = present + wfh + late;
        int workingDays = actual.Count(d => d.Status != "weekoff");   // elapsed working days this month
        double totalHours = Math.Round(actual.Sum(d => d.Hours), 1);
        double overtimeHours = Math.Round(actual.Sum(d => d.OvertimeMin) / 60.0, 1);
        double attendanceRate = workingDays == 0 ? 0 : Math.Round((double)worked / workingDays * 100, 1);
        double onTime = (present + late) == 0 ? 100 : Math.Round((double)present / (present + late) * 100, 1);
        double avgHours = worked == 0 ? 0 : Math.Round(totalHours / worked, 1);
        return new AttendanceMonthSummaryDto(present, wfh, late, leave, absent, weekoff,
            workingDays, worked, attendanceRate, onTime, totalHours, avgHours, overtimeHours);
    }

    // ---- time-correction requests (self-service → reporting-manager approval) ----

    public sealed record CorrectionBody(DateOnly Date, string Status, string? InTime, string? OutTime, string? Reason);
    public sealed record RejectBody(string? Note);

    /// <summary>
    /// Correction requests. <c>scope=team</c> returns the requests the caller can approve (their reports);
    /// otherwise the caller's own requests. Optionally filtered by status.
    /// </summary>
    [HttpGet("corrections")]
    public async Task<IActionResult> ListCorrections([FromQuery] string? scope = null, [FromQuery] string? status = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        var q = db.AttendanceCorrections.AsNoTracking();

        if (string.Equals(scope, "team", StringComparison.OrdinalIgnoreCase))
        {
            if (!acc.CanManage)
            {
                if (acc.ManagedIds.Count == 0) return Ok(Array.Empty<AttendanceCorrectionDto>());
                var ids = acc.ManagedIds.ToArray();
                q = q.Where(c => ids.Contains(c.EmployeeId));
            }
        }
        else
        {
            if (acc.SelfId is not Guid sid) return Ok(Array.Empty<AttendanceCorrectionDto>());
            q = q.Where(c => c.EmployeeId == sid);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CorrectionStatus>(status, true, out var st))
            q = q.Where(c => c.Status == st);

        var rows = await q.OrderByDescending(c => c.RequestedAt).ToListAsync(ct);
        return Ok(rows.Select(ToCorrectionDto));
    }

    /// <summary>Submit a correction for the CALLER'S OWN attendance — routed to their reporting manager.</summary>
    [HttpPost("corrections")]
    public async Task<IActionResult> SubmitCorrection([FromBody] CorrectionBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (acc.Self is null) return BadRequest(new { message = "No employee record is linked to your account." });

        var allowed = new[] { "present", "late", "wfh", "leave", "absent" };
        var status = (body.Status ?? "").ToLowerInvariant();
        if (!allowed.Contains(status))
            return BadRequest(new { message = "Status must be one of: present, late, wfh, leave, absent." });
        if (string.IsNullOrWhiteSpace(body.Reason))
            return BadRequest(new { message = "A reason is required for a correction request." });

        var self = acc.Self;
        var inT = status is "leave" or "absent" ? null : NullIfBlank(body.InTime);
        var outT = status is "leave" or "absent" ? null : NullIfBlank(body.OutTime);

        string? approverName = self.Manager;
        string? approverEmail = null;
        if (self.ManagerId is Guid mid)
        {
            var mgr = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == mid, ct);
            if (mgr is not null) { approverName = mgr.Name.Full; approverEmail = mgr.Email.Value; }
        }

        // Supersede any still-open request for the same day.
        var open = await db.AttendanceCorrections
            .FirstOrDefaultAsync(c => c.EmployeeId == self.Id && c.Date == body.Date && c.Status == CorrectionStatus.Pending, ct);
        open?.Cancel(acc.SelfName);

        var req = AttendanceCorrection.Create(self.TenantId, self.Id, self.Name.Full, body.Date, status, inT, outT, body.Reason!.Trim(), approverName);
        db.AttendanceCorrections.Add(req);

        if (!string.IsNullOrWhiteSpace(approverEmail))
            db.Notifications.Add(AppNotification.Create(self.TenantId,
                "Time correction to review",
                $"{self.Name.Full} requested an attendance correction for {body.Date:dd MMM yyyy}. Review and approve.",
                NotificationKind.Warn, DateTime.UtcNow, read: false, link: "/my-work/attendance", recipientEmail: approverEmail));

        await db.SaveChangesAsync(ct);
        return Ok(ToCorrectionDto(req));
    }

    /// <summary>Approve a correction — applies it as an attendance override. Manager/HR only.</summary>
    [HttpPost("corrections/{id:guid}/approve")]
    public async Task<IActionResult> ApproveCorrection(Guid id, CancellationToken ct)
    {
        var req = await db.AttendanceCorrections.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (req is null) return NotFound();
        var acc = await access.ResolveAsync(ct);
        if (!acc.CanManageEmployee(req.EmployeeId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only approve corrections for your team." });
        if (req.Status != CorrectionStatus.Pending)
            return BadRequest(new { message = "This request has already been decided." });

        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == req.EmployeeId, ct);
        if (emp is null) return NotFound(new { message = "Employee not found." });

        req.Approve(acc.SelfName ?? "Manager");

        var existing = await db.AttendanceOverrides.FirstOrDefaultAsync(o => o.EmployeeId == req.EmployeeId && o.Date == req.Date, ct);
        if (existing is null)
            db.AttendanceOverrides.Add(AttendanceOverride.Create(emp.TenantId, req.EmployeeId, req.Date, req.RequestedStatus, req.RequestedInTime, req.RequestedOutTime, acc.SelfName ?? "Manager"));
        else
            existing.Update(req.RequestedStatus, req.RequestedInTime, req.RequestedOutTime, acc.SelfName ?? "Manager");

        NotifyEmployee(emp, $"Your attendance correction for {req.Date:dd MMM yyyy} was approved.", NotificationKind.Success);

        await db.SaveChangesAsync(ct);
        return Ok(ToCorrectionDto(req));
    }

    /// <summary>Reject a correction (optional note). Manager/HR only.</summary>
    [HttpPost("corrections/{id:guid}/reject")]
    public async Task<IActionResult> RejectCorrection(Guid id, [FromBody] RejectBody? body, CancellationToken ct)
    {
        var req = await db.AttendanceCorrections.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (req is null) return NotFound();
        var acc = await access.ResolveAsync(ct);
        if (!acc.CanManageEmployee(req.EmployeeId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only reject corrections for your team." });
        if (req.Status != CorrectionStatus.Pending)
            return BadRequest(new { message = "This request has already been decided." });

        req.Reject(acc.SelfName ?? "Manager", NullIfBlank(body?.Note));
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == req.EmployeeId, ct);
        if (emp is not null)
            NotifyEmployee(emp, $"Your attendance correction for {req.Date:dd MMM yyyy} was not approved.", NotificationKind.Danger);

        await db.SaveChangesAsync(ct);
        return Ok(ToCorrectionDto(req));
    }

    /// <summary>Cancel a pending correction — the requester, or someone who manages them.</summary>
    [HttpPost("corrections/{id:guid}/cancel")]
    public async Task<IActionResult> CancelCorrection(Guid id, CancellationToken ct)
    {
        var req = await db.AttendanceCorrections.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (req is null) return NotFound();
        var acc = await access.ResolveAsync(ct);
        if (acc.SelfId != req.EmployeeId && !acc.CanManageEmployee(req.EmployeeId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only cancel your own requests." });
        if (req.Status != CorrectionStatus.Pending)
            return BadRequest(new { message = "Only pending requests can be cancelled." });

        req.Cancel(acc.SelfName ?? "");
        await db.SaveChangesAsync(ct);
        return Ok(ToCorrectionDto(req));
    }

    private void NotifyEmployee(Employee emp, string message, NotificationKind kind)
    {
        var email = emp.Email.Value;
        if (string.IsNullOrWhiteSpace(email)) return;
        db.Notifications.Add(AppNotification.Create(emp.TenantId,
            "Attendance correction update", message, kind, DateTime.UtcNow, read: false, link: "/my-requests", recipientEmail: email));
    }

    private static AttendanceCorrectionDto ToCorrectionDto(AttendanceCorrection c) => new(
        c.Id, c.EmployeeId, c.EmployeeName, c.Date, c.RequestedStatus, c.RequestedInTime, c.RequestedOutTime,
        c.Reason, c.Status.ToString().ToLowerInvariant(), c.Approver, c.RequestedAt, c.DecidedAt, c.DecidedBy, c.DecisionNote);

    /// <summary>Create or update a manual attendance correction for an employee on a day (admin/self edit).</summary>
    [HttpPut("entry")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpsertEntry([FromBody] AttendanceEntryBody body, CancellationToken ct)
    {
        if (!(await access.ResolveAsync(ct)).CanManageEmployee(body.EmployeeId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only edit attendance for your team." });

        var allowed = new[] { "present", "late", "wfh", "leave", "absent" };
        var status = (body.Status ?? "").ToLowerInvariant();
        if (!allowed.Contains(status))
            return BadRequest(new { message = "Status must be one of: present, late, wfh, leave, absent." });

        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == body.EmployeeId, ct);
        if (emp is null) return NotFound(new { message = "Employee not found." });

        var inT = status is "leave" or "absent" ? null : NullIfBlank(body.InTime);
        var outT = status is "leave" or "absent" ? null : NullIfBlank(body.OutTime);

        var existing = await db.AttendanceOverrides
            .FirstOrDefaultAsync(o => o.EmployeeId == body.EmployeeId && o.Date == body.Date, ct);
        if (existing is null)
            db.AttendanceOverrides.Add(AttendanceOverride.Create(emp.TenantId, body.EmployeeId, body.Date, status, inT, outT, "admin"));
        else
            existing.Update(status, inT, outT, "admin");

        await db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    /// <summary>Remove a manual correction so the day reverts to the system-generated entry.</summary>
    [HttpDelete("entry")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetEntry([FromQuery] Guid employeeId, [FromQuery] DateOnly date, CancellationToken ct)
    {
        if (!(await access.ResolveAsync(ct)).CanManageEmployee(employeeId))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You can only edit attendance for your team." });

        var existing = await db.AttendanceOverrides
            .FirstOrDefaultAsync(o => o.EmployeeId == employeeId && o.Date == date, ct);
        if (existing is not null)
        {
            db.AttendanceOverrides.Remove(existing);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    private static string? NullIfBlank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    public sealed record AttendanceEntryBody(Guid EmployeeId, DateOnly Date, string Status, string? InTime, string? OutTime);

    private static IReadOnlyList<int>? ParseWeekendDays(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv)) return null;
        var days = csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var n) ? n : -1)
            .Where(n => n is >= 0 and <= 6)
            .Distinct()
            .ToList();
        return days.Count == 0 ? null : days;
    }

    /// <summary>Distinct departments, for the board's department filter.</summary>
    [HttpGet("departments")]
    public async Task<IActionResult> Departments(CancellationToken ct)
    {
        var depts = await db.Employees.AsNoTracking()
            .Select(e => e.Department).Distinct().OrderBy(d => d).ToListAsync(ct);
        return Ok(depts);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateOnly? date = null, [FromQuery] string? department = null, CancellationToken ct = default)
    {
        var q = db.AttendanceRecords.AsNoTracking();
        if (date.HasValue) q = q.Where(r => r.Date == date.Value);
        if (!string.IsNullOrWhiteSpace(department)) q = q.Where(r => r.Department == department);

        var rows = await q.OrderBy(r => r.EmployeeName).Select(r => new
        {
            date = r.Date,
            name = r.EmployeeName,
            dept = r.Department,
            inTime = r.InTime ?? "—",
            outTime = r.OutTime ?? "—",
            hours = r.Hours,
            status = r.Status.ToString().ToLowerInvariant()
        }).ToListAsync(ct);
        return Ok(rows);
    }
}
