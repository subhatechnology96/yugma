using Yugma.Crm.Api.Attendance;
using Yugma.Crm.Domain.Hr.Attendance;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/hr/attendance")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class AttendanceController(YugmaDbContext db) : ControllerBase
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

        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
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

    /// <summary>Create or update a manual attendance correction for an employee on a day (admin/self edit).</summary>
    [HttpPut("entry")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpsertEntry([FromBody] AttendanceEntryBody body, CancellationToken ct)
    {
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
