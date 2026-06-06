using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Attendance;

public enum CorrectionStatus { Pending, Approved, Rejected, Cancelled }

/// <summary>
/// A self-service request to correct an employee's attendance for a day (wrong/missed punch, etc.).
/// Unlike an <see cref="AttendanceOverride"/> — which applies immediately — a correction must be
/// approved by the employee's reporting manager. On approval it materialises into an override.
/// </summary>
public sealed class AttendanceCorrection : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public string EmployeeName { get; private set; } = default!;
    public DateOnly Date { get; private set; }
    public string RequestedStatus { get; private set; } = default!; // present | late | wfh | leave | absent
    public string? RequestedInTime { get; private set; }
    public string? RequestedOutTime { get; private set; }
    public string Reason { get; private set; } = default!;
    public CorrectionStatus Status { get; private set; }
    public string? Approver { get; private set; }            // reporting manager name (snapshot)
    public DateTime RequestedAt { get; private set; }
    public DateTime? DecidedAt { get; private set; }
    public string? DecidedBy { get; private set; }
    public string? DecisionNote { get; private set; }

    private AttendanceCorrection() { } // EF

    public static AttendanceCorrection Create(
        Guid tenantId, Guid employeeId, string employeeName, DateOnly date,
        string requestedStatus, string? inTime, string? outTime, string reason, string? approver)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            EmployeeName = employeeName,
            Date = date,
            RequestedStatus = requestedStatus,
            RequestedInTime = inTime,
            RequestedOutTime = outTime,
            Reason = reason,
            Status = CorrectionStatus.Pending,
            Approver = approver,
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

    public void Approve(string? by)
    {
        Status = CorrectionStatus.Approved;
        Decide(by, null);
    }

    public void Reject(string? by, string? note)
    {
        Status = CorrectionStatus.Rejected;
        Decide(by, note);
    }

    public void Cancel(string? by)
    {
        Status = CorrectionStatus.Cancelled;
        Decide(by, null);
    }

    private void Decide(string? by, string? note)
    {
        DecidedAt = DateTime.UtcNow;
        DecidedBy = by;
        DecisionNote = note;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
