using System.Security.Claims;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Access;

/// <summary>
/// Resolves the current user's HR access once per request. Three tiers:
/// <list type="bullet">
/// <item><b>Manage (all)</b> — HR-department members and admins/owners; see and manage everyone.</item>
/// <item><b>Team</b> — anyone with direct/indirect reports in the org tree; see their team (self + reports)
/// and manage their reports' data, but not org-wide structure.</item>
/// <item><b>Self</b> — everyone else; see and self-service only their own data.</item>
/// </list>
/// Used by every HR controller so the rule is applied consistently.
/// </summary>
public sealed class HrAccess(IHttpContextAccessor accessor, YugmaDbContext db)
{
    public const string HrDepartment = "Human Resources";

    private HrAccessResult? _cached;

    public async Task<HrAccessResult> ResolveAsync(CancellationToken ct = default)
    {
        if (_cached is not null) return _cached;

        var user = accessor.HttpContext?.User;
        var email = (user?.FindFirstValue(ClaimTypes.Email) ?? user?.FindFirstValue("email"))?.Trim().ToLowerInvariant();
        var roles = user?.FindAll(ClaimTypes.Role).Select(c => c.Value.ToLowerInvariant()).ToHashSet() ?? new HashSet<string>();
        var isAdmin = roles.Overlaps(new[] { "admin", "owner", "super_admin" });

        var all = await db.Employees.AsNoTracking()
            .Select(e => new EmpNode(e.Id, e.ManagerId, e.HrPartnerId, e.Name.First + " " + e.Name.Last, e.Department, e.Email.Value))
            .ToListAsync(ct);

        var self = !string.IsNullOrWhiteSpace(email) ? all.FirstOrDefault(e => string.Equals(e.Email, email, StringComparison.OrdinalIgnoreCase)) : null;
        var selfEmployee = self is null ? null : await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == self.Id, ct);

        var isHr = self is not null && self.Department.Equals(HrDepartment, StringComparison.OrdinalIgnoreCase);
        var canManage = isHr || isAdmin;

        // Reports that roll up to the current user (direct + indirect).
        var managedIds = self is null ? new HashSet<Guid>() : Descendants(self.Id, all);
        var managedNames = all.Where(e => managedIds.Contains(e.Id)).Select(e => e.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Read scope (what they may SEE) and manage scope (what they may EDIT/APPROVE). null = everyone.
        IReadOnlySet<Guid>? visibleIds;
        IReadOnlySet<Guid>? manageableIds;
        if (isAdmin)
        {
            visibleIds = null;            // admins/owners: the whole company
            manageableIds = null;
        }
        else if (isHr)
        {
            // HR partner's "book": the employees explicitly assigned to this HR person (+ their own row).
            var book = all.Where(e => e.HrPartnerId == self!.Id).Select(e => e.Id).ToHashSet();
            manageableIds = book;
            visibleIds = new HashSet<Guid>(book) { self!.Id };
        }
        else
        {
            // Team lead → self + reports (manage reports); plain employee → just self (manage nobody).
            var vis = new HashSet<Guid>(managedIds);
            if (self is not null) vis.Add(self.Id);
            visibleIds = vis;
            manageableIds = managedIds;
        }

        IReadOnlySet<string>? NamesOf(IReadOnlySet<Guid>? ids) =>
            ids is null ? null : all.Where(e => ids.Contains(e.Id)).Select(e => e.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var visibleNames = NamesOf(visibleIds);
        var manageableNames = NamesOf(manageableIds);

        var scope = canManage ? "all" : (managedIds.Count > 0 ? "team" : "self");

        return _cached = new HrAccessResult(
            email, canManage, isHr, selfEmployee, scope,
            visibleIds, visibleNames, manageableIds, manageableNames, managedIds, managedNames);
    }

    /// <summary>All employee ids that report — directly or transitively — to the given employee.</summary>
    private static HashSet<Guid> Descendants(Guid rootId, IReadOnlyList<EmpNode> all)
    {
        var children = all.Where(e => e.ManagerId is not null)
            .GroupBy(e => e.ManagerId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());
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

    private sealed record EmpNode(Guid Id, Guid? ManagerId, Guid? HrPartnerId, string Name, string Department, string Email);
}

/// <summary>Outcome of <see cref="HrAccess.ResolveAsync"/>.</summary>
public sealed record HrAccessResult(
    string? Email,
    bool CanManage,
    bool IsHr,
    Employee? Self,
    string Scope,                                  // "all" | "team" | "self"
    IReadOnlySet<Guid>? VisibleIds,                // null = all; HR = their book + self; lead = self + reports
    IReadOnlySet<string>? VisibleNames,            // by employee full name (for name-keyed tables)
    IReadOnlySet<Guid>? ManageableIds,             // null = all (admin); HR = their book; lead = reports; else empty
    IReadOnlySet<string>? ManageableNames,         // manageable set by employee full name
    IReadOnlySet<Guid> ManagedIds,                 // reports only (excludes self)
    IReadOnlySet<string> ManagedNames)
{
    public bool Restricted => !CanManage;
    public bool IsTeamLead => ManagedIds.Count > 0;
    public Guid? SelfId => Self?.Id;
    public string? SelfName => Self?.Name.Full;
    public string? SelfEmail => Self?.Email.Value ?? Email;

    /// <summary>True if the user may READ this employee's data (everyone for admins; their book for HR; team for leads; self otherwise).</summary>
    public bool CanSeeEmployee(Guid employeeId) => VisibleIds is null || VisibleIds.Contains(employeeId);

    /// <summary>True if the user may MANAGE this employee's data (admins anyone; HR their book; team leads their reports).</summary>
    public bool CanManageEmployee(Guid employeeId) => ManageableIds is null || ManageableIds.Contains(employeeId);
    public bool CanManageEmployee(string employeeName) => ManageableNames is null || ManageableNames.Contains(employeeName);
}
