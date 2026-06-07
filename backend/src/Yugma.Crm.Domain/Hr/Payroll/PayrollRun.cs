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
    public int Year { get; set; }
    public int Month { get; set; }
    public string? Notes { get; set; }

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

    /// <summary>Creates an editable payroll run for a specific month.</summary>
    public static PayrollRun ForMonth(Guid tenantId, int year, int month, string cycle, string? createdBy = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Year = year,
            Month = month,
            Cycle = cycle,
            Status = PayrollStatus.Draft,
            RunAt = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };

    /// <summary>Refreshes the headline totals from the run's payslips.</summary>
    public void Recalc(decimal total, int employees, string? by)
    {
        Total = total;
        Employees = employees;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }

    /// <summary>Moves the run along Draft → Processing → Approved → Paid.</summary>
    public void SetStatus(PayrollStatus status, string? by)
    {
        Status = status;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
