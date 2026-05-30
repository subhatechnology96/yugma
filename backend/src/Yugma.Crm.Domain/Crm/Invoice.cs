using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm;

public enum InvoiceStatus { Paid, Pending, Overdue }

public sealed class Invoice : Entity<Guid>, IAggregateRoot
{
    public string Number { get; set; } = default!;
    public string Customer { get; set; } = default!;
    public DateOnly IssuedAt { get; set; }
    public DateOnly DueAt { get; set; }
    public decimal Amount { get; set; }
    public InvoiceStatus Status { get; set; }

    public static Invoice Create(Guid tenantId, string number, string customer, DateOnly issued, DateOnly due, decimal amount, InvoiceStatus status)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Number = number,
            Customer = customer,
            IssuedAt = issued,
            DueAt = due,
            Amount = amount,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };
}
