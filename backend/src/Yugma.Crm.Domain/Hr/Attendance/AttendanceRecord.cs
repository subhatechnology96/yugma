using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Attendance;

public enum AttendanceStatus { Present, Late, Absent, Wfh, Leave }

public sealed class AttendanceRecord : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; set; }
    public DateOnly Date { get; set; }
    public string EmployeeName { get; set; } = default!;
    public string Department { get; set; } = default!;
    public string? InTime { get; set; }
    public string? OutTime { get; set; }
    public decimal Hours { get; set; }
    public AttendanceStatus Status { get; set; }

    public static AttendanceRecord Create(Guid tenantId, DateOnly date, string employee, string department, string? inTime, string? outTime, decimal hours, AttendanceStatus status, Guid employeeId = default)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Date = date,
            EmployeeName = employee,
            Department = department,
            InTime = inTime,
            OutTime = outTime,
            Hours = hours,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };
}
