using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Services;

/// <summary>The kind of service work — each maps to a menu item (Project / Field Service / Helpdesk / Appointments).</summary>
public enum ServiceType { Project, FieldService, Helpdesk, Appointment }

/// <summary>The pipeline stage a service order is in.</summary>
public enum ServiceStage { New, Scheduled, InProgress, Review, Done, Cancelled }

public enum ServicePriority { Low, Medium, High, Urgent }

/// <summary>One step in a service order's history (stage move, assignment, time log). Stored as JSON.</summary>
public sealed class ServiceEvent
{
    public string Kind { get; set; } = "move";          // move | assign | time | note | create
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Note { get; set; }
    public string? By { get; set; }
    public DateTime At { get; set; }
}

/// <summary>
/// A unit of service work that flows through a single pipeline (New → Scheduled → In Progress → Review → Done).
/// The <see cref="Type"/> distinguishes Project / Field Service / Helpdesk / Appointment views over the same board.
/// </summary>
public sealed class ServiceOrder : Entity<Guid>, IAggregateRoot
{
    public string Code { get; private set; } = default!;
    public string Title { get; private set; } = default!;
    public ServiceType Type { get; private set; }
    public ServiceStage Stage { get; private set; }
    public ServicePriority Priority { get; private set; }
    public string Customer { get; private set; } = default!;
    public string? AssignedTo { get; private set; }
    public DateTime? ScheduledAt { get; private set; }
    public DateOnly? DueAt { get; private set; }
    public decimal EstimatedHours { get; private set; }
    public string? Description { get; private set; }

    private readonly List<string> _tags = new();
    public IReadOnlyList<string> Tags => _tags.AsReadOnly();

    public List<ServiceEvent> Activity { get; private set; } = new();

    private ServiceOrder() { } // EF

    public static ServiceOrder Create(
        Guid tenantId, string code, string title, ServiceType type, string customer,
        ServiceStage stage = ServiceStage.New, ServicePriority priority = ServicePriority.Medium,
        string? assignedTo = null, DateTime? scheduledAt = null, DateOnly? dueAt = null,
        decimal estimatedHours = 0, string? description = null, IEnumerable<string>? tags = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(customer)) throw new ArgumentException("Customer is required.", nameof(customer));

        var o = new ServiceOrder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim(),
            Title = title.Trim(),
            Type = type,
            Stage = stage,
            Priority = priority,
            Customer = customer.Trim(),
            AssignedTo = string.IsNullOrWhiteSpace(assignedTo) ? null : assignedTo.Trim(),
            ScheduledAt = scheduledAt,
            DueAt = dueAt,
            EstimatedHours = estimatedHours < 0 ? 0 : estimatedHours,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        if (tags is not null) o._tags.AddRange(tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()));
        o.Activity.Add(new ServiceEvent { Kind = "create", To = stage.ToString().ToLowerInvariant(), Note = "Order created", By = createdBy, At = DateTime.UtcNow });
        return o;
    }

    public void MoveTo(ServiceStage stage, string? by, string? note = null)
    {
        var from = Stage;
        Stage = stage;
        Touch(by);
        Activity.Add(new ServiceEvent
        {
            Kind = "move",
            From = from.ToString().ToLowerInvariant(),
            To = stage.ToString().ToLowerInvariant(),
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            By = by,
            At = DateTime.UtcNow
        });
    }

    public void Assign(string? assignedTo, DateTime? scheduledAt, string? by, string? note = null)
    {
        AssignedTo = string.IsNullOrWhiteSpace(assignedTo) ? null : assignedTo.Trim();
        if (scheduledAt is not null) ScheduledAt = scheduledAt;
        Touch(by);
        var when = scheduledAt is { } d ? $" for {d:dd MMM yyyy}" : "";
        Activity.Add(new ServiceEvent
        {
            Kind = "assign",
            Note = string.IsNullOrWhiteSpace(note) ? $"Assigned to {AssignedTo ?? "unassigned"}{when}" : note.Trim(),
            By = by,
            At = DateTime.UtcNow
        });
    }

    /// <summary>Logs a free-text timeline note when hours are booked (the hours themselves live in ServiceTimesheet).</summary>
    public void LogTime(string person, decimal hours, string? note, string? by)
    {
        Touch(by);
        Activity.Add(new ServiceEvent
        {
            Kind = "time",
            Note = $"{person} logged {hours:0.##}h{(string.IsNullOrWhiteSpace(note) ? "" : $" — {note.Trim()}")}",
            By = by,
            At = DateTime.UtcNow
        });
    }

    public void UpdateDetails(string title, ServiceType type, string customer, ServicePriority priority,
        DateOnly? dueAt, decimal estimatedHours, string? description, IEnumerable<string>? tags, string? by)
    {
        Title = title.Trim();
        Type = type;
        Customer = customer.Trim();
        Priority = priority;
        DueAt = dueAt;
        EstimatedHours = estimatedHours < 0 ? 0 : estimatedHours;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        _tags.Clear();
        if (tags is not null) _tags.AddRange(tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()));
        Touch(by);
    }

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
