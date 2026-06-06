using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Audit;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Org;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Team management: search, reporting hierarchy/org structure, effective-dated manager/team/department
/// reassignment (single + bulk), reporting history and audit. Each employee's snapshot is the joining
/// baseline; effective-dated <see cref="ReportingAssignment"/> rows overlay it to compute the current line.
/// </summary>
[ApiController]
[Route("api/my-work/team")]
[Produces("application/json")]
[Authorize] // reads scoped to self for non-privileged; reassignment requires HR/admin (CanManage)
public sealed class TeamController(YugmaDbContext db, HrAccess access) : ControllerBase
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private static IActionResult Forbidden(string message) =>
        new ObjectResult(new { message }) { StatusCode = StatusCodes.Status403Forbidden };

    // ---------------- search ----------------
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q = null, [FromQuery] string? department = null, [FromQuery] string? manager = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        var (employees, active) = await CurrentAsync(ct);
        if (acc.VisibleIds is { } vis) employees = employees.Where(e => vis.Contains(e.Id)).ToList();
        var rows = employees.Select(e => Row(e, active)).AsEnumerable();

        if (!string.IsNullOrWhiteSpace(department)) rows = rows.Where(r => string.Equals(r.Department, department, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(manager)) rows = rows.Where(r => string.Equals(r.Manager, manager, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            rows = rows.Where(r =>
                r.Name.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                r.Code.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                r.Email.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                r.Department.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (r.Team ?? "").Contains(s, StringComparison.OrdinalIgnoreCase));
        }
        return Ok(rows.OrderBy(r => r.Name).ToList());
    }

    [HttpGet("managers")]
    public async Task<IActionResult> Managers(CancellationToken ct)
    {
        var (employees, active) = await CurrentAsync(ct);
        var names = employees.Select(e => e.Name.Full)
            .Concat(employees.Select(e => CurMgr(e, active)).Where(m => !string.IsNullOrWhiteSpace(m))!)
            .Distinct().OrderBy(n => n).ToList();
        var depts = employees.Select(e => CurDept(e, active)).Distinct().OrderBy(d => d).ToList();
        return Ok(new { managers = names, departments = depts });
    }

    // ---------------- hierarchy / org chart ----------------
    [HttpGet("hierarchy")]
    public async Task<IActionResult> Hierarchy(CancellationToken ct)
    {
        var (employees, active) = await CurrentAsync(ct);
        var byManager = employees.GroupBy(e => CurMgr(e, active) ?? "")
            .ToDictionary(g => g.Key, g => g.ToList());
        var empNames = new HashSet<string>(employees.Select(e => e.Name.Full));

        // roots = managers who are not themselves employees, plus employees with no/unknown manager
        var rootNames = employees.Select(e => CurMgr(e, active) ?? "")
            .Where(m => !string.IsNullOrWhiteSpace(m) && !empNames.Contains(m))
            .Distinct().ToList();

        object NodeForEmployee(Employee e, HashSet<Guid> visited)
        {
            var kids = byManager.TryGetValue(e.Name.Full, out var list) ? list : new List<Employee>();
            return new
            {
                employeeId = e.Id,
                name = e.Name.Full,
                code = e.Code,
                designation = e.Designation,
                department = CurDept(e, active),
                isEmployee = true,
                children = kids.Where(k => visited.Add(k.Id)).Select(k => NodeForEmployee(k, visited)).ToList()
            };
        }

        var visited = new HashSet<Guid>();
        var roots = new List<object>();
        foreach (var rn in rootNames.OrderBy(x => x))
        {
            var reports = byManager.TryGetValue(rn, out var list) ? list : new List<Employee>();
            roots.Add(new
            {
                employeeId = (Guid?)null,
                name = rn,
                code = "",
                designation = "Leadership",
                department = "",
                isEmployee = false,
                children = reports.Where(k => visited.Add(k.Id)).Select(k => NodeForEmployee(k, visited)).ToList()
            });
        }
        // any employees not reached (no manager / cycle) become roots
        foreach (var e in employees.Where(e => !visited.Contains(e.Id)))
        {
            visited.Add(e.Id);
            roots.Add(NodeForEmployee(e, visited));
        }
        return Ok(roots);
    }

    // ---------------- reporting history ----------------
    [HttpGet("employee/{id:guid}/history")]
    public async Task<IActionResult> History(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound();
        var rows = await db.ReportingAssignments.AsNoTracking()
            .Where(a => a.EmployeeId == id).OrderBy(a => a.EffectiveFrom).ToListAsync(ct);

        var history = new List<HistoryRow>();
        if (rows.Count == 0)
            history.Add(new HistoryRow(emp.Manager, emp.Department, null, emp.JoinedAt, null, "Joining", "system", false));
        else
            history.AddRange(rows.Select(a => new HistoryRow(
                a.Manager, a.Department, a.Team, a.EffectiveFrom, a.EffectiveTo, a.Reason ?? "", a.ChangedBy ?? "", a.EffectiveFrom > Today)));

        return Ok(history.OrderByDescending(h => h.From).ToList());
    }

    // ---------------- preview (validation only) ----------------
    [HttpPost("assignments/preview")]
    public async Task<IActionResult> Preview([FromBody] AssignBody body, CancellationToken ct)
    {
        var (employees, active) = await CurrentAsync(ct);
        var warnings = new List<object>();

        foreach (var empId in body.EmployeeIds)
        {
            var e = employees.FirstOrDefault(x => x.Id == empId);
            if (e is null) continue;
            if (!string.IsNullOrWhiteSpace(body.Manager))
            {
                if (string.Equals(body.Manager, e.Name.Full, StringComparison.OrdinalIgnoreCase))
                    warnings.Add(new { employeeId = empId, name = e.Name.Full, warning = "An employee cannot report to themselves." });
                else if (Descendants(e.Name.Full, employees, active).Contains(body.Manager))
                    warnings.Add(new { employeeId = empId, name = e.Name.Full, warning = $"'{body.Manager}' currently reports under {e.Name.Full} — this would create a cycle." });
            }
        }
        return Ok(new { count = body.EmployeeIds.Length, scheduled = body.EffectiveFrom > Today, warnings });
    }

    // ---------------- assign / reassign (single + bulk) ----------------
    [HttpPost("assignments")]
    public async Task<IActionResult> Assign([FromBody] AssignBody body, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return Forbidden("Only HR or an administrator can reassign reporting lines.");
        if (body.EmployeeIds.Length == 0) return BadRequest(new { message = "No employees selected." });

        var employees = await db.Employees.ToListAsync(ct);
        var assignments = await db.ReportingAssignments.ToListAsync(ct);
        var today = Today;
        bool applyNow = body.EffectiveFrom <= today;
        var actor = string.IsNullOrWhiteSpace(body.ChangedBy) ? "Admin" : body.ChangedBy!.Trim();

        int changed = 0;
        foreach (var empId in body.EmployeeIds)
        {
            var e = employees.FirstOrDefault(x => x.Id == empId);
            if (e is null) continue;

            // cycle guard
            if (!string.IsNullOrWhiteSpace(body.Manager) &&
                (string.Equals(body.Manager, e.Name.Full, StringComparison.OrdinalIgnoreCase) ||
                 Descendants(e.Name.Full, employees, assignments).Contains(body.Manager)))
                continue;

            var curMgr = CurMgr(e, assignments);
            var curDept = CurDept(e, assignments);
            var curTeam = CurTeam(e, assignments);

            var newMgr = string.IsNullOrWhiteSpace(body.Manager) ? curMgr : body.Manager.Trim();
            var newDept = string.IsNullOrWhiteSpace(body.Department) ? curDept : body.Department.Trim();
            var newTeam = string.IsNullOrWhiteSpace(body.Team) ? curTeam : body.Team.Trim();

            // ensure a baseline (joining) row exists so history is complete
            var openLine = assignments.FirstOrDefault(a => a.EmployeeId == empId && a.EffectiveTo == null && a.EffectiveFrom <= today);
            if (openLine is null && !assignments.Any(a => a.EmployeeId == empId))
            {
                var baseline = ReportingAssignment.Create(e.TenantId, empId, e.Manager, e.Department, null, null, e.JoinedAt, "Joining", "system");
                if (applyNow) baseline.Close(body.EffectiveFrom.AddDays(-1), actor);
                db.ReportingAssignments.Add(baseline);
                assignments.Add(baseline);
                openLine = applyNow ? null : baseline;
            }

            if (applyNow)
            {
                openLine?.Close(body.EffectiveFrom.AddDays(-1), actor);
                var line = ReportingAssignment.Create(e.TenantId, empId, newMgr, newDept, newTeam, body.Project, body.EffectiveFrom, body.Reason, actor);
                db.ReportingAssignments.Add(line);
                assignments.Add(line);
                // keep the employee snapshot consistent with the current line
                e.Reassign(newDept ?? e.Department, e.Designation, newMgr, actor);
            }
            else
            {
                // future-dated → scheduled line, snapshot unchanged until effective
                var line = ReportingAssignment.Create(e.TenantId, empId, newMgr, newDept, newTeam, body.Project, body.EffectiveFrom, body.Reason, actor);
                db.ReportingAssignments.Add(line);
                assignments.Add(line);
            }

            db.AuditLogs.Add(AuditLog.Create(e.TenantId, DateTime.UtcNow, actor, "hierarchy.reassign",
                $"{e.Name.Full}: manager→{newMgr}, dept→{newDept}{(newTeam != null ? $", team→{newTeam}" : "")} (eff {body.EffectiveFrom}{(applyNow ? "" : ", scheduled")})",
                "team-management", AuditOutcome.Success));
            changed++;
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { changed, scheduled = !applyNow });
    }

    // ---------------- helpers ----------------
    private async Task<(List<Employee> Employees, List<ReportingAssignment> Active)> CurrentAsync(CancellationToken ct)
    {
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        var assignments = await db.ReportingAssignments.AsNoTracking().ToListAsync(ct);
        return (employees, assignments);
    }

    private static ReportingAssignment? ActiveLine(Guid empId, List<ReportingAssignment> all)
        => all.Where(a => a.EmployeeId == empId && a.EffectiveTo == null && a.EffectiveFrom <= DateOnly.FromDateTime(DateTime.UtcNow))
              .OrderByDescending(a => a.EffectiveFrom).FirstOrDefault();

    private static string? CurMgr(Employee e, List<ReportingAssignment> all)
    {
        var a = ActiveLine(e.Id, all);
        return a?.Manager ?? e.Manager;
    }
    private static string CurDept(Employee e, List<ReportingAssignment> all)
    {
        var a = ActiveLine(e.Id, all);
        return a?.Department ?? e.Department;
    }
    private static string? CurTeam(Employee e, List<ReportingAssignment> all) => ActiveLine(e.Id, all)?.Team;

    private static TeamRow Row(Employee e, List<ReportingAssignment> active) => new(
        e.Id, e.Name.Full, e.Code, e.Email.Value, e.Designation, CurDept(e, active), CurMgr(e, active), CurTeam(e, active), e.AvatarUrl, e.Location);

    private sealed record TeamRow(Guid Id, string Name, string Code, string Email, string Designation, string Department, string? Manager, string? Team, string? AvatarUrl, string Location);
    private sealed record HistoryRow(string? Manager, string? Department, string? Team, DateOnly From, DateOnly? To, string Reason, string ChangedBy, bool Scheduled);

    /// <summary>All employees (by name) that currently report — directly or indirectly — under the given manager name.</summary>
    private static HashSet<string> Descendants(string managerName, List<Employee> employees, List<ReportingAssignment> active)
    {
        var byManager = employees.GroupBy(e => CurMgr(e, active) ?? "").ToDictionary(g => g.Key, g => g.Select(x => x.Name.Full).ToList());
        var result = new HashSet<string>();
        var queue = new Queue<string>();
        queue.Enqueue(managerName);
        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            if (!byManager.TryGetValue(cur, out var reports)) continue;
            foreach (var r in reports)
                if (result.Add(r)) queue.Enqueue(r);
        }
        return result;
    }

    public sealed record AssignBody(Guid[] EmployeeIds, string? Manager, string? Department, string? Team, string? Project, DateOnly EffectiveFrom, string? Reason, string? ChangedBy);
}
