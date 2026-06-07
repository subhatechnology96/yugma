using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Services;

/// <summary>A single time entry booked against a service order (the source of truth for the Timesheets view).</summary>
public sealed class ServiceTimesheet : Entity<Guid>, IAggregateRoot
{
    public Guid OrderId { get; private set; }
    public string Person { get; private set; } = default!;
    public DateOnly Date { get; private set; }
    public decimal Hours { get; private set; }
    public string? Note { get; private set; }

    private ServiceTimesheet() { } // EF

    public static ServiceTimesheet Create(Guid tenantId, Guid orderId, string person, DateOnly date, decimal hours, string? note, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(person)) throw new ArgumentException("Person is required.", nameof(person));
        if (hours <= 0) throw new ArgumentException("Hours must be greater than zero.", nameof(hours));
        return new ServiceTimesheet
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OrderId = orderId,
            Person = person.Trim(),
            Date = date,
            Hours = hours,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }
}
