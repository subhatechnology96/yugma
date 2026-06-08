using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.SupplyChain;

public enum MaintenanceStage { New, InProgress, Repaired, Scrap }
public enum MaintenanceKind { Corrective, Preventive }

/// <summary>A maintenance request against a piece of equipment.</summary>
public sealed class MaintenanceRequest : Entity<Guid>, IAggregateRoot
{
    public string Reference { get; private set; } = default!;
    public string Title { get; private set; } = default!;
    public string Equipment { get; private set; } = default!;
    public MaintenanceKind Kind { get; private set; }
    public MaintenanceStage Stage { get; private set; }
    public int Priority { get; private set; }
    public string? Responsible { get; private set; }
    public string? Category { get; private set; }
    public DateOnly? ScheduledDate { get; private set; }
    public decimal Duration { get; private set; }   // hours
    public string? Description { get; private set; }

    private MaintenanceRequest() { }

    public static MaintenanceRequest Create(Guid tenantId, string reference, string title, string equipment, MaintenanceKind kind,
        MaintenanceStage stage = MaintenanceStage.New, int priority = 0, string? responsible = null, string? category = null,
        DateOnly? scheduledDate = null, decimal duration = 0, string? description = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(equipment)) throw new ArgumentException("Equipment is required.", nameof(equipment));
        return new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Reference = reference.Trim(),
            Title = title.Trim(),
            Equipment = equipment.Trim(),
            Kind = kind,
            Stage = stage,
            Priority = Math.Clamp(priority, 0, 3),
            Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim(),
            ScheduledDate = scheduledDate,
            Duration = duration < 0 ? 0 : duration,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void MoveStage(MaintenanceStage stage, string? by) { Stage = stage; UpdatedAt = DateTime.UtcNow; UpdatedBy = by; }

    public void Update(string title, string equipment, MaintenanceKind kind, int priority, string? responsible, string? category, DateOnly? scheduledDate, decimal duration, string? description, string? by)
    {
        if (!string.IsNullOrWhiteSpace(title)) Title = title.Trim();
        if (!string.IsNullOrWhiteSpace(equipment)) Equipment = equipment.Trim();
        Kind = kind;
        Priority = Math.Clamp(priority, 0, 3);
        Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim();
        Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim();
        ScheduledDate = scheduledDate;
        Duration = duration < 0 ? 0 : duration;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}
