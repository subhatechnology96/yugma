using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.Leave;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/hr/leave")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class LeaveController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
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
        var q = db.LeaveRequests.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<LeaveStatus>(status, true, out var s))
            q = q.Where(r => r.Status == s);
        if (!string.IsNullOrWhiteSpace(employee))
            q = q.Where(r => r.Employee == employee);

        var rows = await q.OrderByDescending(r => r.FromDate).ToListAsync(ct);
        var idByName = await EmployeeIdByNameAsync(ct);
        return Ok(rows.Select(r => ToDto(r, idByName)));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var all = await db.LeaveRequests.AsNoTracking().ToListAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
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
        var all = await db.LeaveRequests.AsNoTracking().ToListAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        return Ok(ComputeBalances(employees, all, await EntitlementsAsync(ct)));
    }

    // ---------------- commands ----------------

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLeaveBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Employee))
            return BadRequest(new { error = "validation", message = "Employee is required." });

        var type = ParseType(body.Type);
        var from = body.From;
        var to = body.To < body.From ? body.From : body.To;
        var days = body.Days > 0 ? body.Days : (to.DayNumber - from.DayNumber + 1);

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
    public Task<IActionResult> Approve(Guid id, CancellationToken ct) => Decide(id, r => r.Approve("HR Admin"), ct);

    [HttpPost("{id:guid}/reject")]
    public Task<IActionResult> Reject(Guid id, CancellationToken ct) => Decide(id, r => r.Reject("HR Admin"), ct);

    [HttpPost("{id:guid}/cancel")]
    public Task<IActionResult> Cancel(Guid id, CancellationToken ct) => Decide(id, r => r.Cancel("HR Admin"), ct);

    private async Task<IActionResult> Decide(Guid id, Action<LeaveRequest> apply, CancellationToken ct)
    {
        var req = await db.LeaveRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (req is null) return NotFound();
        apply(req);
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
                double available = Math.Max(0, en.Entitled - used - pending);
                return new LeaveTypeBalance(en.Label, en.Entitled, used, pending, available);
            }).ToList();

            result.Add(new EmployeeBalance(
                e.Id, name, e.Department, e.Designation, e.AvatarUrl,
                byType.Sum(b => b.Entitled), byType.Sum(b => b.Used), byType.Sum(b => b.Pending), byType.Sum(b => b.Available),
                byType));
        }
        return result;
    }

    private static LeaveType ParseType(string? raw)
        => Enum.TryParse<LeaveType>((raw ?? "").Replace("-", string.Empty), true, out var t) ? t : LeaveType.Casual;

    public sealed record CreateLeaveBody(string Employee, string Type, DateOnly From, DateOnly To, int Days, string? Reason);
    public sealed record EditLeaveBody(string Type, DateOnly From, DateOnly To, int Days, string? Reason);

    private sealed record EmployeeBalance(
        Guid EmployeeId, string Name, string Department, string Designation, string? AvatarUrl,
        double TotalEntitled, double TotalUsed, double TotalPending, double TotalAvailable,
        IReadOnlyList<LeaveTypeBalance> ByType);

    private sealed record LeaveTypeBalance(string Type, double Entitled, double Used, double Pending, double Available);
}
