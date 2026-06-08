using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.SupplyChain;

/// <summary>Stage of an engineering change order (ECO) in the PLM workflow.</summary>
public enum EcoStage { New, InProgress, Approved, Done, Rejected }
public enum EcoType { BillOfMaterials, ProductDesign, Routing, Documentation }

/// <summary>An Engineering Change Order — a tracked change to a product's design or bill of materials (PLM).</summary>
public sealed class EngineeringChange : Entity<Guid>, IAggregateRoot
{
    public string Reference { get; private set; } = default!;
    public string Title { get; private set; } = default!;
    public string Product { get; private set; } = default!;
    public EcoType ChangeType { get; private set; }
    public EcoStage Stage { get; private set; }
    public int Priority { get; private set; }
    public string? Responsible { get; private set; }
    public string? Description { get; private set; }
    public DateOnly? EffectiveDate { get; private set; }

    private EngineeringChange() { }

    public static EngineeringChange Create(Guid tenantId, string reference, string title, string product, EcoType type,
        EcoStage stage = EcoStage.New, int priority = 0, string? responsible = null, string? description = null,
        DateOnly? effectiveDate = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        return new EngineeringChange
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Reference = reference.Trim(),
            Title = title.Trim(),
            Product = string.IsNullOrWhiteSpace(product) ? "—" : product.Trim(),
            ChangeType = type,
            Stage = stage,
            Priority = Math.Clamp(priority, 0, 3),
            Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            EffectiveDate = effectiveDate,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void MoveStage(EcoStage stage, string? by) { Stage = stage; UpdatedAt = DateTime.UtcNow; UpdatedBy = by; }

    public void Update(string title, string product, EcoType type, int priority, string? responsible, string? description, DateOnly? effectiveDate, string? by)
    {
        if (!string.IsNullOrWhiteSpace(title)) Title = title.Trim();
        Product = string.IsNullOrWhiteSpace(product) ? "—" : product.Trim();
        ChangeType = type;
        Priority = Math.Clamp(priority, 0, 3);
        Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        EffectiveDate = effectiveDate;
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}
