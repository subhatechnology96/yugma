using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Audit;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Org;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Hierarchy management: L1..L10 band system, ManagerId-based reporting tree and trail-to-CEO,
/// dynamic manager/band changes (cycle-guarded, audited, mirrored to <see cref="ReportingAssignment"/>
/// history), bulk upload and org analytics. <c>ManagerId</c> on <see cref="Employee"/> is authoritative.
/// </summary>
[ApiController]
[Route("api/my-work/hierarchy")]
[Produces("application/json")]
[Authorize] // reads scoped to self for non-privileged; mutations require HR/admin (CanManage)
public sealed class HierarchyController(YugmaDbContext db, ITenantContext tenant, HrAccess access) : ControllerBase
{
    private static IActionResult Forbidden(string message) =>
        new ObjectResult(new { message }) { StatusCode = StatusCodes.Status403Forbidden };
    // ---------------- level catalog (loaded from the hierarchy_levels table) ----------------
    private Dictionary<int, (string Code, string Title)> _levels = new();

    /// <summary>Loads the band catalog from Postgres once per request; feeds LevelCode/LevelTitle.</summary>
    private async Task EnsureLevelsAsync(CancellationToken ct)
    {
        if (_levels.Count > 0) return;
        _levels = await db.HierarchyLevels.AsNoTracking()
            .ToDictionaryAsync(l => l.Rank, l => (l.Code, l.Title), ct);
    }

    private string LevelTitle(int? band) => band is not null && _levels.TryGetValue(band.Value, out var l) ? l.Title : "Unassigned";
    private string LevelCode(int? band) => band is not null && _levels.TryGetValue(band.Value, out var l) ? l.Code : "—";

    [HttpGet("levels")]
    public async Task<IActionResult> GetLevels(CancellationToken ct)
    {
        var levels = await db.HierarchyLevels.AsNoTracking().OrderBy(l => l.Rank).ToListAsync(ct);
        return Ok(levels.Select(l => new { rank = l.Rank, code = l.Code, title = l.Title, description = l.Description }));
    }

    // ---------------- meta (departments + managers) ----------------
    [HttpGet("meta")]
    public async Task<IActionResult> Meta(CancellationToken ct)
    {
        await EnsureLevelsAsync(ct);
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var departments = emps.Select(e => e.Department).Distinct().OrderBy(d => d).ToList();
        var managers = emps.OrderByDescending(e => e.Band ?? 0).ThenBy(e => e.Name.Full)
            .Select(e => new { id = e.Id, name = e.Name.Full, code = e.Code, band = e.Band, levelTitle = LevelTitle(e.Band), department = e.Department })
            .ToList();
        return Ok(new { departments, managers });
    }

    // ---------------- employees table ----------------
    [HttpGet("employees")]
    public async Task<IActionResult> Employees([FromQuery] string? q = null, [FromQuery] string? department = null, [FromQuery] int? band = null, CancellationToken ct = default)
    {
        await EnsureLevelsAsync(ct);
        var acc = await access.ResolveAsync(ct);
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var directs = emps.Where(e => e.ManagerId != null).GroupBy(e => e.ManagerId!.Value).ToDictionary(g => g.Key, g => g.Count());
        var byId = emps.ToDictionary(e => e.Id);

        IEnumerable<Employee> rows = emps;
        if (acc.VisibleIds is { } vis) rows = rows.Where(e => vis.Contains(e.Id)); // managers see all, team leads their team, others themselves
        if (!string.IsNullOrWhiteSpace(department)) rows = rows.Where(e => string.Equals(e.Department, department, StringComparison.OrdinalIgnoreCase));
        if (band is not null) rows = rows.Where(e => e.Band == band);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            rows = rows.Where(e =>
                e.Name.Full.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                e.Code.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                e.Email.Value.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                e.Designation.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                e.Department.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        return Ok(rows.OrderByDescending(e => e.Band ?? 0).ThenBy(e => e.Name.Full).Select(e => EmpDto(e, byId, directs)));
    }

    // ---------------- org tree ----------------
    [HttpGet("tree")]
    public async Task<IActionResult> Tree([FromQuery] string? department = null, CancellationToken ct = default)
    {
        await EnsureLevelsAsync(ct);
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var children = emps.Where(e => e.ManagerId != null).GroupBy(e => e.ManagerId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var ids = emps.Select(e => e.Id).ToHashSet();

        // Roots: no manager, or a manager that doesn't exist anymore.
        var roots = emps.Where(e => e.ManagerId == null || !ids.Contains(e.ManagerId.Value))
            .OrderByDescending(e => e.Band ?? 0).ThenBy(e => e.Name.Full).ToList();

        var visited = new HashSet<Guid>();
        TreeNodeDto Build(Employee e)
        {
            visited.Add(e.Id);
            var kids = (children.TryGetValue(e.Id, out var list) ? list : new List<Employee>())
                .Where(k => visited.Add(k.Id))
                .OrderByDescending(k => k.Band ?? 0).ThenBy(k => k.Name.Full)
                .Select(Build).ToList();
            return new TreeNodeDto(e.Id, e.Name.Full, e.Code, e.Designation, e.Department, e.Band, LevelCode(e.Band), LevelTitle(e.Band), e.AvatarUrl, false, kids);
        }

        var tree = roots.Select(Build).ToList();
        // any employee not reached (orphaned by a cycle) becomes its own root
        foreach (var e in emps.Where(e => !visited.Contains(e.Id)))
            tree.Add(Build(e));

        if (!string.IsNullOrWhiteSpace(department))
            tree = tree.Select(n => Prune(n, department!)).Where(n => n is not null).Select(n => n!).ToList();

        return Ok(tree);
    }

    // keep a node if it (or any descendant) is in the department
    private static TreeNodeDto? Prune(TreeNodeDto node, string dept)
    {
        var keptKids = node.Children.Select(c => Prune(c, dept)).Where(c => c is not null).Select(c => c!).ToList();
        var self = string.Equals(node.Department, dept, StringComparison.OrdinalIgnoreCase);
        if (!self && keptKids.Count == 0) return null;
        return node with { Children = keptKids };
    }

    // ---------------- reporting trail to CEO ----------------
    [HttpGet("employee/{id:guid}/trail")]
    public async Task<IActionResult> Trail(Guid id, CancellationToken ct)
    {
        // Open like the org tree/lineage: anyone may view a reporting trail to the CEO.
        await EnsureLevelsAsync(ct);
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var byId = emps.ToDictionary(e => e.Id);
        if (!byId.TryGetValue(id, out var start)) return NotFound();

        var trail = new List<object>();
        var visited = new HashSet<Guid>();
        var cur = start;
        while (cur is not null && visited.Add(cur.Id))
        {
            trail.Add(new
            {
                employeeId = cur.Id,
                name = cur.Name.Full,
                code = cur.Code,
                band = cur.Band,
                levelCode = LevelCode(cur.Band),
                levelTitle = LevelTitle(cur.Band),
                designation = cur.Designation,
                department = cur.Department,
                avatarUrl = cur.AvatarUrl,
                isYou = cur.Id == id
            });
            cur = cur.ManagerId is Guid mid && byId.TryGetValue(mid, out var mgr) ? mgr : null;
        }
        // trail[0] = employee … trail[^1] = CEO (top)
        return Ok(trail);
    }

    // ---------------- focused lineage (chain up to CEO + the person's own subtree) ----------------
    /// <summary>
    /// A focused org slice for one person: the spine of managers from the CEO down to them, with the
    /// person's full reporting subtree (direct + indirect reports) nested underneath. Powers the
    /// "my hierarchy" default view and the "view someone's hierarchy" search. Returns a single root.
    /// </summary>
    [HttpGet("employee/{id:guid}/lineage")]
    public async Task<IActionResult> Lineage(Guid id, CancellationToken ct)
    {
        await EnsureLevelsAsync(ct);
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var byId = emps.ToDictionary(e => e.Id);
        if (!byId.TryGetValue(id, out var focus)) return NotFound();

        var children = emps.Where(e => e.ManagerId != null).GroupBy(e => e.ManagerId!.Value).ToDictionary(g => g.Key, g => g.ToList());

        // The focus person's own subtree (themselves + everyone who rolls up to them).
        var visited = new HashSet<Guid>();
        TreeNodeDto BuildSubtree(Employee e, bool isFocus)
        {
            visited.Add(e.Id);
            var kids = (children.TryGetValue(e.Id, out var list) ? list : new List<Employee>())
                .Where(k => visited.Add(k.Id))
                .OrderByDescending(k => k.Band ?? 0).ThenBy(k => k.Name.Full)
                .Select(k => BuildSubtree(k, false)).ToList();
            return new TreeNodeDto(e.Id, e.Name.Full, e.Code, e.Designation, e.Department, e.Band, LevelCode(e.Band), LevelTitle(e.Band), e.AvatarUrl, isFocus, kids);
        }
        var node = BuildSubtree(focus, true);

        // Nest under each ancestor up to the top (cycle-guarded).
        var seen = new HashSet<Guid> { focus.Id };
        var cur = focus;
        while (cur.ManagerId is Guid mid && byId.TryGetValue(mid, out var mgr) && seen.Add(mgr.Id))
        {
            node = new TreeNodeDto(mgr.Id, mgr.Name.Full, mgr.Code, mgr.Designation, mgr.Department, mgr.Band, LevelCode(mgr.Band), LevelTitle(mgr.Band), mgr.AvatarUrl, false, new List<TreeNodeDto> { node });
            cur = mgr;
        }
        return Ok(new[] { node });
    }

    // ---------------- add employee ----------------
    public sealed record AddEmployeeBody(string Name, string? Code, string Email, string? Phone, string Department, string Designation, int Band, Guid? ManagerId, string? Location, string? ActedBy);

    [HttpPost("employee")]
    public async Task<IActionResult> AddEmployee([FromBody] AddEmployeeBody body, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return Forbidden("Only HR or an administrator can add employees.");
        await EnsureLevelsAsync(ct);
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { error = "Name is required." });
        if (string.IsNullOrWhiteSpace(body.Email)) return BadRequest(new { error = "Email is required." });
        if (body.Band is < 1 or > 10) return BadRequest(new { error = "Band must be 1..10." });

        var email = body.Email.Trim().ToLowerInvariant();
        if (await db.Employees.AnyAsync(e => e.Email.Value == email, ct))
            return Conflict(new { error = "An employee with that email already exists." });

        var code = string.IsNullOrWhiteSpace(body.Code) ? await NextCodeAsync(ct) : body.Code.Trim();
        var actor = Actor(body.ActedBy);

        Employee? manager = body.ManagerId is Guid mid ? await db.Employees.FirstOrDefaultAsync(e => e.Id == mid, ct) : null;

        var emp = Employee.Create(
            tenant.TenantId, code,
            PersonName.Create(body.Name.Trim()),
            Email.Create(email),
            PhoneNumber.Create(string.IsNullOrWhiteSpace(body.Phone) ? "+91 00000 00000" : body.Phone!.Trim()),
            body.Department.Trim(), body.Designation.Trim(),
            string.IsNullOrWhiteSpace(body.Location) ? "Bengaluru" : body.Location!.Trim(),
            EmploymentType.FullTime, DateOnly.FromDateTime(DateTime.UtcNow), 0m,
            manager?.Name.Full, null, actor);
        emp.SetBand(body.Band, actor);
        emp.SetManager(manager?.Id, manager?.Name.Full, actor);
        db.Employees.Add(emp);

        // seed a joining reporting line so the history/trail is complete from day one
        db.ReportingAssignments.Add(ReportingAssignment.Create(emp.TenantId, emp.Id, manager?.Name.Full, emp.Department, null, null, emp.JoinedAt, "Joining", actor));
        Audit(emp.TenantId, actor, "hierarchy.employee.add", $"Added {emp.Name.Full} ({LevelCode(body.Band)} · {emp.Designation}) reporting to {manager?.Name.Full ?? "—"}");
        await db.SaveChangesAsync(ct);

        var byId = await db.Employees.AsNoTracking().ToDictionaryAsync(e => e.Id, ct);
        var directs = byId.Values.Where(e => e.ManagerId != null).GroupBy(e => e.ManagerId!.Value).ToDictionary(g => g.Key, g => g.Count());
        return Created($"/api/my-work/hierarchy/employee/{emp.Id}", EmpDto(emp, byId, directs));
    }

    // ---------------- change band ----------------
    public sealed record BandBody(int Band, string? ActedBy);

    [HttpPost("employee/{id:guid}/band")]
    public async Task<IActionResult> SetBand(Guid id, [FromBody] BandBody body, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return Forbidden("Only HR or an administrator can change bands.");
        await EnsureLevelsAsync(ct);
        if (body.Band is < 1 or > 10) return BadRequest(new { error = "Band must be 1..10." });
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound();
        var prev = emp.Band;
        emp.SetBand(body.Band, Actor(body.ActedBy));
        Audit(emp.TenantId, body.ActedBy, "hierarchy.band.change", $"{emp.Name.Full}: band {LevelCode(prev)} → {LevelCode(body.Band)}");
        await db.SaveChangesAsync(ct);
        return Ok(new { id = emp.Id, band = emp.Band, levelCode = LevelCode(emp.Band), levelTitle = LevelTitle(emp.Band) });
    }

    // ---------------- change manager (with cycle guard + history) ----------------
    public sealed record ManagerBody(Guid? ManagerId, string? Reason, string? ActedBy);

    [HttpPost("employee/{id:guid}/manager/preview")]
    public async Task<IActionResult> PreviewManager(Guid id, [FromBody] ManagerBody body, CancellationToken ct)
    {
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var emp = emps.FirstOrDefault(e => e.Id == id);
        if (emp is null) return NotFound();
        var (ok, warning) = ValidateManager(emp, body.ManagerId, emps);
        return Ok(new { ok, warning });
    }

    [HttpPost("employee/{id:guid}/manager")]
    public async Task<IActionResult> SetManagerEndpoint(Guid id, [FromBody] ManagerBody body, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return Forbidden("Only HR or an administrator can change reporting lines.");
        var emps = await db.Employees.ToListAsync(ct);
        var emp = emps.FirstOrDefault(e => e.Id == id);
        if (emp is null) return NotFound();

        var (ok, warning) = ValidateManager(emp, body.ManagerId, emps);
        if (!ok) return BadRequest(new { error = warning });

        var manager = body.ManagerId is Guid mid ? emps.FirstOrDefault(e => e.Id == mid) : null;
        var actor = Actor(body.ActedBy);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // mirror to reporting_assignments for a continuous history (close the open line, open a new one)
        var lines = await db.ReportingAssignments.Where(a => a.EmployeeId == id).ToListAsync(ct);
        if (lines.Count == 0)
        {
            var baseline = ReportingAssignment.Create(emp.TenantId, id, emp.Manager, emp.Department, null, null, emp.JoinedAt, "Joining", "system");
            baseline.Close(today.AddDays(-1), actor);
            db.ReportingAssignments.Add(baseline);
        }
        else
        {
            foreach (var open in lines.Where(a => a.EffectiveTo == null && a.EffectiveFrom <= today))
                open.Close(today.AddDays(-1), actor);
        }
        db.ReportingAssignments.Add(ReportingAssignment.Create(emp.TenantId, id, manager?.Name.Full, emp.Department, null, null, today, body.Reason ?? "Manager change", actor));

        emp.SetManager(manager?.Id, manager?.Name.Full, actor);
        Audit(emp.TenantId, actor, "hierarchy.manager.change", $"{emp.Name.Full} now reports to {manager?.Name.Full ?? "— (top of org)"}");
        await db.SaveChangesAsync(ct);

        return Ok(new { id = emp.Id, managerId = emp.ManagerId, manager = emp.Manager });
    }

    // ---------------- bulk upload ----------------
    public sealed record BulkItem(string Code, int? Band, string? ManagerCode);
    public sealed record BulkBody(BulkItem[] Items, string? ActedBy);

    [HttpPost("bulk")]
    public async Task<IActionResult> Bulk([FromBody] BulkBody body, CancellationToken ct)
    {
        if ((await access.ResolveAsync(ct)).Restricted) return Forbidden("Only HR or an administrator can bulk-update the hierarchy.");
        if (body.Items is null || body.Items.Length == 0) return BadRequest(new { error = "No rows provided." });
        var emps = await db.Employees.ToListAsync(ct);
        var byCode = emps.ToDictionary(e => e.Code, StringComparer.OrdinalIgnoreCase);
        var actor = Actor(body.ActedBy);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        int applied = 0; var errors = new List<object>();
        foreach (var item in body.Items)
        {
            if (string.IsNullOrWhiteSpace(item.Code) || !byCode.TryGetValue(item.Code.Trim(), out var emp))
            { errors.Add(new { code = item.Code, error = "Unknown employee code." }); continue; }

            if (item.Band is not null)
            {
                if (item.Band is < 1 or > 10) { errors.Add(new { code = item.Code, error = "Band must be 1..10." }); continue; }
                emp.SetBand(item.Band, actor);
            }

            if (!string.IsNullOrWhiteSpace(item.ManagerCode))
            {
                if (!byCode.TryGetValue(item.ManagerCode.Trim(), out var mgr))
                { errors.Add(new { code = item.Code, error = $"Unknown manager code '{item.ManagerCode}'." }); continue; }
                var (ok, warning) = ValidateManager(emp, mgr.Id, emps);
                if (!ok) { errors.Add(new { code = item.Code, error = warning }); continue; }

                foreach (var open in (await db.ReportingAssignments.Where(a => a.EmployeeId == emp.Id && a.EffectiveTo == null).ToListAsync(ct)))
                    open.Close(today.AddDays(-1), actor);
                db.ReportingAssignments.Add(ReportingAssignment.Create(emp.TenantId, emp.Id, mgr.Name.Full, emp.Department, null, null, today, "Bulk upload", actor));
                emp.SetManager(mgr.Id, mgr.Name.Full, actor);
            }
            applied++;
        }

        Audit(tenant.TenantId, actor, "hierarchy.bulk", $"Bulk hierarchy update: {applied} applied, {errors.Count} skipped");
        await db.SaveChangesAsync(ct);
        return Ok(new { applied, skipped = errors.Count, errors });
    }

    // ---------------- analytics ----------------
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(CancellationToken ct)
    {
        await EnsureLevelsAsync(ct);
        var emps = await db.Employees.AsNoTracking().ToListAsync(ct);
        var byId = emps.ToDictionary(e => e.Id);
        var directs = emps.Where(e => e.ManagerId != null).GroupBy(e => e.ManagerId!.Value).ToDictionary(g => g.Key, g => g.Count());

        var byLevel = _levels.OrderBy(l => l.Key)
            .Select(l => new { band = l.Key, code = l.Value.Code, title = l.Value.Title, count = emps.Count(e => e.Band == l.Key) }).ToList();
        var byDept = emps.GroupBy(e => e.Department)
            .Select(g => new { department = g.Key, count = g.Count(), avgBand = Math.Round(g.Average(e => e.Band ?? 0), 1) })
            .OrderByDescending(x => x.count).ToList();

        var managerIds = directs.Keys.ToHashSet();
        var avgSpan = managerIds.Count == 0 ? 0 : Math.Round((double)directs.Values.Sum() / managerIds.Count, 1);
        var widest = directs.OrderByDescending(kv => kv.Value).Take(5)
            .Where(kv => byId.ContainsKey(kv.Key))
            .Select(kv => new { manager = byId[kv.Key].Name.Full, levelCode = LevelCode(byId[kv.Key].Band), directReports = kv.Value }).ToList();

        // depth: longest manager chain
        int Depth(Employee e)
        {
            int d = 1; var seen = new HashSet<Guid>(); var cur = e;
            while (cur.ManagerId is Guid mid && byId.TryGetValue(mid, out var m) && seen.Add(cur.Id)) { d++; cur = m; }
            return d;
        }
        var maxDepth = emps.Count == 0 ? 0 : emps.Max(Depth);
        var unassigned = emps.Where(e => (e.ManagerId == null || !byId.ContainsKey(e.ManagerId.Value)) && (e.Band ?? 0) < 10).Count();
        var noBand = emps.Count(e => e.Band == null);

        return Ok(new
        {
            totalEmployees = emps.Count,
            managers = managerIds.Count,
            individualContributors = emps.Count(e => !managerIds.Contains(e.Id)),
            avgSpanOfControl = avgSpan,
            maxDepth,
            unassigned,
            noBand,
            byLevel,
            byDepartment = byDept,
            widestSpans = widest
        });
    }

    // ---------------- helpers ----------------
    private (bool Ok, string? Warning) ValidateManager(Employee emp, Guid? managerId, List<Employee> all)
    {
        if (managerId is null) return (true, null); // detaching → becomes a root
        if (managerId == emp.Id) return (false, "An employee cannot report to themselves.");
        if (!all.Any(e => e.Id == managerId)) return (false, "Selected manager does not exist.");
        if (Descendants(emp.Id, all).Contains(managerId.Value))
        {
            var mgrName = all.First(e => e.Id == managerId).Name.Full;
            return (false, $"'{mgrName}' currently reports under {emp.Name.Full} — this would create a cycle.");
        }
        return (true, null);
    }

    /// <summary>All employee ids that report — directly or indirectly — under the given employee (via ManagerId).</summary>
    private static HashSet<Guid> Descendants(Guid rootId, List<Employee> all)
    {
        var children = all.Where(e => e.ManagerId != null).GroupBy(e => e.ManagerId!.Value).ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());
        var result = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(rootId);
        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            if (!children.TryGetValue(cur, out var kids)) continue;
            foreach (var k in kids) if (result.Add(k)) queue.Enqueue(k);
        }
        return result;
    }

    private async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var codes = await db.Employees.AsNoTracking().Select(e => e.Code).ToListAsync(ct);
        var max = codes.Select(c => int.TryParse(c.Replace("YUG-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0).DefaultIfEmpty(1000).Max();
        return $"YUG-{max + 1}";
    }

    private object EmpDto(Employee e, IReadOnlyDictionary<Guid, Employee> byId, IReadOnlyDictionary<Guid, int> directs) => new
    {
        id = e.Id,
        code = e.Code,
        name = e.Name.Full,
        email = e.Email.Value,
        department = e.Department,
        designation = e.Designation,
        location = e.Location,
        band = e.Band,
        levelCode = LevelCode(e.Band),
        levelTitle = LevelTitle(e.Band),
        managerId = e.ManagerId,
        managerName = e.ManagerId is Guid mid && byId.TryGetValue(mid, out var m) ? m.Name.Full : e.Manager,
        managerBand = e.ManagerId is Guid mid2 && byId.TryGetValue(mid2, out var m2) ? m2.Band : (int?)null,
        directReports = directs.TryGetValue(e.Id, out var c) ? c : 0,
        avatarUrl = e.AvatarUrl,
        status = e.Status.ToString()
    };

    private static string Actor(string? actedBy) => string.IsNullOrWhiteSpace(actedBy) ? "Admin" : actedBy.Trim();
    private void Audit(Guid tenantId, string? actedBy, string action, string resource) =>
        db.AuditLogs.Add(AuditLog.Create(tenantId, DateTime.UtcNow, Actor(actedBy), action, resource,
            HttpContext.Connection.RemoteIpAddress?.ToString(), AuditOutcome.Success));

    private sealed record TreeNodeDto(Guid Id, string Name, string Code, string Designation, string Department, int? Band, string LevelCode, string LevelTitle, string? AvatarUrl, bool IsFocus, List<TreeNodeDto> Children);
}
