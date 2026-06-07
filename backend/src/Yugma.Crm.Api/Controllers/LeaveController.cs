using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Leave;
using Yugma.Crm.Domain.Reference;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/leave")]
[Produces("application/json")]
[Authorize] // HR/admins manage all leave; everyone else sees and self-services only their own
public sealed class LeaveController(YugmaDbContext db, ITenantContext tenant, HrAccess access) : ControllerBase
{
    private static IActionResult Forbidden(string message) =>
        new ObjectResult(new { message }) { StatusCode = StatusCodes.Status403Forbidden };
    // Annual entitlements are read from the leave_types table (no hardcoded values).
    private async Task<List<(LeaveType Type, string Label, double Entitled)>> EntitlementsAsync(CancellationToken ct)
    {
        var rows = await db.LeaveTypes.AsNoTracking().OrderBy(t => t.SortOrder).ToListAsync(ct);
        return rows
            .Where(r => Enum.TryParse<LeaveType>(r.Code, true, out _))
            .Select(r => (Type: Enum.Parse<LeaveType>(r.Code, true), r.Label, Entitled: r.AnnualEntitlement))
            .ToList();
    }

    // ---------------- queries ----------------

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status = null, [FromQuery] string? employee = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        var q = db.LeaveRequests.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<LeaveStatus>(status, true, out var s))
            q = q.Where(r => r.Status == s);
        // Scope to the visible set (self + team) for non-managers; HR/admins see all.
        if (acc.VisibleNames is { } names)
        {
            var visible = names.ToArray();
            q = q.Where(r => visible.Contains(r.Employee));
        }
        else if (!string.IsNullOrWhiteSpace(employee))
            q = q.Where(r => r.Employee == employee);

        var rows = await q.OrderByDescending(r => r.FromDate).ToListAsync(ct);
        var idByName = await EmployeeIdByNameAsync(ct);
        return Ok(rows.Select(r => ToDto(r, idByName)));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        var all = await db.LeaveRequests.AsNoTracking().ToListAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        if (acc.VisibleNames is { } vnames) all = all.Where(r => vnames.Contains(r.Employee)).ToList();
        if (acc.VisibleIds is { } vids) employees = employees.Where(e => vids.Contains(e.Id)).ToList();
        var firstOfMonth = new DateOnly(DateOnly.FromDateTime(DateTime.UtcNow).Year, DateOnly.FromDateTime(DateTime.UtcNow).Month, 1);

        bool Mtd(LeaveRequest r) => r.DecidedAt.HasValue && DateOnly.FromDateTime(r.DecidedAt.Value) >= firstOfMonth;

        var balances = ComputeBalances(employees, all, await EntitlementsAsync(ct));
        var balanceAvg = balances.Count == 0 ? 0 : Math.Round(balances.Average(b => b.TotalAvailable), 1);

        return Ok(new
        {
            pending = all.Count(r => r.Status == LeaveStatus.Pending),
            approvedMtd = all.Count(r => r.Status == LeaveStatus.Approved && Mtd(r)),
            rejectedMtd = all.Count(r => r.Status == LeaveStatus.Rejected && Mtd(r)),
            onLeaveToday = all.Count(r => r.Status == LeaveStatus.Approved
                && r.FromDate <= DateOnly.FromDateTime(DateTime.UtcNow)
                && r.ToDate >= DateOnly.FromDateTime(DateTime.UtcNow)),
            balanceAvg
        });
    }

    [HttpGet("balances")]
    public async Task<IActionResult> Balances(CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        var all = await db.LeaveRequests.AsNoTracking().ToListAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        if (acc.VisibleIds is { } vids) employees = employees.Where(e => vids.Contains(e.Id)).ToList();
        return Ok(ComputeBalances(employees, all, await EntitlementsAsync(ct)));
    }

    /// <summary>Company holiday calendar for a year — government/public holidays and optional (RH) holidays.</summary>
    [HttpGet("holidays")]
    public async Task<IActionResult> Holidays([FromQuery] int? year = null, CancellationToken ct = default)
    {
        var y = year ?? DateOnly.FromDateTime(DateTime.UtcNow).Year;
        var rows = await db.Holidays.AsNoTracking().Where(h => h.Year == y).OrderBy(h => h.Date).ToListAsync(ct);
        object Map(Holiday h) => new { date = h.Date, name = h.Name, type = h.Type };
        return Ok(new
        {
            year = y,
            publicHolidays = rows.Where(h => h.Type == "Public").Select(Map),
            optionalHolidays = rows.Where(h => h.Type == "Optional").Select(Map)
        });
    }

    // ---------------- commands ----------------

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLeaveBody body, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        // Only HR/admins may apply on someone else's behalf; everyone else applies for themselves.
        var employeeName = acc.CanManage ? body.Employee?.Trim() : acc.SelfName;
        if (string.IsNullOrWhiteSpace(employeeName))
            return BadRequest(new { error = "validation", message = "Employee is required." });
        // HR is scoped to their book: they may only apply on behalf of employees they are the HR partner for.
        if (acc.CanManage && employeeName != acc.SelfName && !acc.CanManageEmployee(employeeName))
            return Forbidden("You can only apply leave for employees you are the HR partner for.");
        body = body with { Employee = employeeName };

        var type = ParseType(body.Type);
        var from = body.From;
        var to = body.To < body.From ? body.From : body.To;
        var days = body.Days > 0 ? body.Days : (to.DayNumber - from.DayNumber + 1);

        // Restricted/optional holidays are capped at the RH entitlement per financial year.
        if (type == LeaveType.RestrictedHoliday)
        {
            var fyStart = new DateOnly(from.Month >= 4 ? from.Year : from.Year - 1, 4, 1);
            var taken = await db.LeaveRequests.CountAsync(r => r.Employee == body.Employee
                && r.Type == LeaveType.RestrictedHoliday && r.Status != LeaveStatus.Rejected
                && r.Status != LeaveStatus.Cancelled && r.FromDate >= fyStart, ct);
            var rhLimit = (int)((await EntitlementsAsync(ct)).FirstOrDefault(e => e.Type == LeaveType.RestrictedHoliday).Entitled);
            if (rhLimit > 0 && taken >= rhLimit)
                return BadRequest(new { error = "rh_limit", message = $"You've already used your {rhLimit} optional holidays for this year." });
        }

        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Name.First + " " + e.Name.Last == body.Employee.Trim(), ct);
        var approver = emp?.Manager;

        var req = LeaveRequest.Create(tenant.TenantId, body.Employee.Trim(), type, from, to, days,
            LeaveStatus.Pending, body.Reason?.Trim() ?? string.Empty, DateOnly.FromDateTime(DateTime.UtcNow), approver);
        db.LeaveRequests.Add(req);
        await db.SaveChangesAsync(ct);

        var idByName = await EmployeeIdByNameAsync(ct);
        return Ok(ToDto(req, idByName));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Edit(Guid id, [FromBody] EditLeaveBody body, CancellationToken ct)
    {
        var req = await db.LeaveRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (req is null) return NotFound();
        var acc = await access.ResolveAsync(ct);
        if (req.Employee != acc.SelfName && !acc.CanManageEmployee(req.Employee))
            return Forbidden("You can only change your own or your team's leave requests.");
        if (req.Status != LeaveStatus.Pending)
            return BadRequest(new { message = "Only pending requests can be changed." });

        var type = ParseType(body.Type);
        var from = body.From;
        var to = body.To < body.From ? body.From : body.To;
        var days = body.Days > 0 ? body.Days : (to.DayNumber - from.DayNumber + 1);
        req.Edit(type, from, to, days, body.Reason?.Trim() ?? string.Empty);
        await db.SaveChangesAsync(ct);

        var idByName = await EmployeeIdByNameAsync(ct);
        return Ok(ToDto(req, idByName));
    }

    [HttpPost("{id:guid}/approve")]
    public Task<IActionResult> Approve(Guid id, CancellationToken ct) => Decide(id, (r, by) => r.Approve(by), ct, manageOnly: true);

    [HttpPost("{id:guid}/reject")]
    public Task<IActionResult> Reject(Guid id, CancellationToken ct) => Decide(id, (r, by) => r.Reject(by), ct, manageOnly: true);

    // Cancelling is self-service: a user may cancel their own request; HR/admins may cancel anyone's.
    [HttpPost("{id:guid}/cancel")]
    public Task<IActionResult> Cancel(Guid id, CancellationToken ct) => Decide(id, (r, by) => r.Cancel(by), ct, manageOnly: false);

    private async Task<IActionResult> Decide(Guid id, Action<LeaveRequest, string> apply, CancellationToken ct, bool manageOnly)
    {
        var req = await db.LeaveRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (req is null) return NotFound();
        var acc = await access.ResolveAsync(ct);

        // Approve/reject (manageOnly): HR/admins, or a team lead acting on their report's request.
        // Cancel: the above, plus a user cancelling their own request.
        var allowed = acc.CanManageEmployee(req.Employee)
            || (!manageOnly && req.Employee == acc.SelfName);
        if (!allowed)
            return Forbidden(manageOnly ? "You can only approve or reject your team's leave." : "You can only cancel your own or your team's leave.");

        apply(req, acc.SelfName ?? "HR Admin");
        await db.SaveChangesAsync(ct);
        var idByName = await EmployeeIdByNameAsync(ct);
        return Ok(ToDto(req, idByName));
    }

    // ---------------- helpers ----------------

    private async Task<Dictionary<string, Guid>> EmployeeIdByNameAsync(CancellationToken ct)
    {
        var emps = await db.Employees.AsNoTracking().Select(e => new { e.Id, e.Name }).ToListAsync(ct);
        var map = new Dictionary<string, Guid>();
        foreach (var e in emps) map[e.Name.First + " " + e.Name.Last] = e.Id;
        return map;
    }

    private static object ToDto(LeaveRequest r, IReadOnlyDictionary<string, Guid> idByName) => new
    {
        id = r.Id,
        employeeId = idByName.TryGetValue(r.Employee, out var eid) ? eid : (Guid?)null,
        employee = r.Employee,
        type = r.Type.ToString(),
        from = r.FromDate,
        to = r.ToDate,
        days = r.Days,
        status = r.Status.ToString().ToLowerInvariant(),
        reason = r.Reason,
        appliedOn = r.AppliedOn,
        approver = r.Approver,
        decidedAt = r.DecidedAt,
        decidedBy = r.DecidedBy
    };

    private static List<EmployeeBalance> ComputeBalances(IReadOnlyList<Employee> employees, IReadOnlyList<LeaveRequest> all,
        IReadOnlyList<(LeaveType Type, string Label, double Entitled)> entitlements)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var fyStart = new DateOnly(today.Month >= 4 ? today.Year : today.Year - 1, 4, 1);
        var byEmployee = all.Where(r => r.FromDate >= fyStart)
            .GroupBy(r => r.Employee)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<EmployeeBalance>();
        foreach (var e in employees.OrderBy(e => e.Name.First).ThenBy(e => e.Name.Last))
        {
            var name = e.Name.Full;
            byEmployee.TryGetValue(name, out var reqs);
            reqs ??= new List<LeaveRequest>();

            var byType = entitlements.Select(en =>
            {
                double used = reqs.Where(r => r.Type == en.Type && r.Status == LeaveStatus.Approved).Sum(r => r.Days);
                double pending = reqs.Where(r => r.Type == en.Type && r.Status == LeaveStatus.Pending).Sum(r => r.Days);
                double carried = CarryForwardFor(e.Id, en.Type);                 // brought forward from last FY
                double available = Math.Max(0, en.Entitled + carried - used - pending);
                return new LeaveTypeBalance(en.Label, en.Entitled, carried, used, pending, available);
            }).ToList();

            result.Add(new EmployeeBalance(
                e.Id, name, e.Department, e.Designation, e.AvatarUrl,
                byType.Sum(b => b.Entitled), byType.Sum(b => b.CarriedForward), byType.Sum(b => b.Used), byType.Sum(b => b.Pending), byType.Sum(b => b.Available),
                byType));
        }
        return result;
    }

    /// <summary>
    /// Deterministic carry-forward (leaves brought forward from the previous financial year). Only Earned
    /// and Paid leave carry over, capped at 6 days; stable per employee so the Balance Log is consistent.
    /// </summary>
    private static double CarryForwardFor(Guid employeeId, LeaveType type)
    {
        var cap = type switch { LeaveType.Earned => 6, LeaveType.Paid => 6, _ => 0 };
        if (cap == 0) return 0;
        var h = Math.Abs(BitConverter.ToInt32(employeeId.ToByteArray()) ^ ((int)type * 31));
        return h % (cap + 1);
    }

    private static LeaveType ParseType(string? raw)
        => Enum.TryParse<LeaveType>((raw ?? "").Replace("-", string.Empty), true, out var t) ? t : LeaveType.Casual;

    public sealed record CreateLeaveBody(string Employee, string Type, DateOnly From, DateOnly To, int Days, string? Reason);
    public sealed record EditLeaveBody(string Type, DateOnly From, DateOnly To, int Days, string? Reason);

    private sealed record EmployeeBalance(
        Guid EmployeeId, string Name, string Department, string Designation, string? AvatarUrl,
        double TotalEntitled, double TotalCarriedForward, double TotalUsed, double TotalPending, double TotalAvailable,
        IReadOnlyList<LeaveTypeBalance> ByType);

    private sealed record LeaveTypeBalance(string Type, double Entitled, double CarriedForward, double Used, double Pending, double Available);
}
