using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Payroll;

public enum PayrollStatus { Draft, Processing, Approved, Paid }

public sealed class PayrollRun : Entity<Guid>, IAggregateRoot
{
    public string Cycle { get; set; } = default!;
    public decimal Total { get; set; }
    public int Employees { get; set; }
    public PayrollStatus Status { get; set; }
    public DateOnly RunAt { get; set; }

    public static PayrollRun Create(Guid tenantId, string cycle, decimal total, int employees, PayrollStatus status, DateOnly runAt)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Cycle = cycle,
            Total = total,
            Employees = employees,
            Status = status,
            RunAt = runAt,
            CreatedAt = DateTime.UtcNow
        };
}
