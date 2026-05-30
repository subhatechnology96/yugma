using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Attendance;

/// <summary>
/// A manual correction to an employee's attendance for a specific day (admin/self-service edit).
/// When present, it takes precedence over the generated roster entry.
/// </summary>
public sealed class AttendanceOverride : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public DateOnly Date { get; private set; }
    public string Status { get; private set; } = default!; // present | late | wfh | leave | absent
    public string? InTime { get; private set; }
    public string? OutTime { get; private set; }

    private AttendanceOverride() { } // EF

    public static AttendanceOverride Create(Guid tenantId, Guid employeeId, DateOnly date, string status, string? inTime, string? outTime, string? editedBy)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Date = date,
            Status = status,
            InTime = inTime,
            OutTime = outTime,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = editedBy
        };

    public void Update(string status, string? inTime, string? outTime, string? editedBy)
    {
        Status = status;
        InTime = inTime;
        OutTime = outTime;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = editedBy;
    }
}
