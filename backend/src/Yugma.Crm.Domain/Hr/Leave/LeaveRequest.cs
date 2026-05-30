using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Leave;

public enum LeaveType { Casual, Sick, Earned, CompOff, Unpaid, Paid, Special, Blocked, RestrictedHoliday }
public enum LeaveStatus { Pending, Approved, Rejected, Cancelled }

public sealed class LeaveRequest : Entity<Guid>, IAggregateRoot
{
    public string Employee { get; set; } = default!;
    public LeaveType Type { get; set; }
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public int Days { get; set; }
    public LeaveStatus Status { get; set; }
    public string Reason { get; set; } = default!;
    public DateOnly AppliedOn { get; set; }
    public string? Approver { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecidedBy { get; set; }

    public static LeaveRequest Create(
        Guid tenantId, string employee, LeaveType type, DateOnly from, DateOnly to, int days,
        LeaveStatus status, string reason, DateOnly? appliedOn = null, string? approver = null,
        DateTime? decidedAt = null, string? decidedBy = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Employee = employee,
            Type = type,
            FromDate = from,
            ToDate = to,
            Days = days,
            Status = status,
            Reason = reason,
            AppliedOn = appliedOn ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Approver = approver,
            DecidedAt = decidedAt,
            DecidedBy = decidedBy,
            CreatedAt = DateTime.UtcNow
        };

    public void Approve(string? by) => Decide(LeaveStatus.Approved, by);
    public void Reject(string? by) => Decide(LeaveStatus.Rejected, by);
    public void Cancel(string? by) => Decide(LeaveStatus.Cancelled, by);

    private void Decide(LeaveStatus status, string? by)
    {
        Status = status;
        DecidedAt = DateTime.UtcNow;
        DecidedBy = by;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }

    public void Edit(LeaveType type, DateOnly from, DateOnly to, int days, string reason)
    {
        Type = type;
        FromDate = from;
        ToDate = to;
        Days = days;
        Reason = reason;
        UpdatedAt = DateTime.UtcNow;
    }
}
