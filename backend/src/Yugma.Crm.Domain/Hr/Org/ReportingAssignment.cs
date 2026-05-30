using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Org;

/// <summary>
/// An effective-dated reporting/hierarchy assignment for an employee. The latest active row
/// (EffectiveFrom &lt;= today and no EffectiveTo) is the employee's current line; closed rows form the
/// reporting history. Captures manager, department, team and optional project allocation.
/// </summary>
public sealed class ReportingAssignment : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public string? Manager { get; private set; }
    public string? Department { get; private set; }
    public string? Team { get; private set; }
    public string? Project { get; private set; }
    public DateOnly EffectiveFrom { get; private set; }
    public DateOnly? EffectiveTo { get; private set; }
    public string? Reason { get; private set; }
    public string? ChangedBy { get; private set; }

    private ReportingAssignment() { } // EF

    public static ReportingAssignment Create(Guid tenantId, Guid employeeId, string? manager, string? department,
        string? team, string? project, DateOnly effectiveFrom, string? reason, string? changedBy)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Manager = manager?.Trim(),
            Department = department?.Trim(),
            Team = team?.Trim(),
            Project = project?.Trim(),
            EffectiveFrom = effectiveFrom,
            Reason = reason?.Trim(),
            ChangedBy = changedBy,
            CreatedAt = DateTime.UtcNow
        };

    public void Close(DateOnly effectiveTo, string? by)
    {
        EffectiveTo = effectiveTo;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
