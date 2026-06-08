using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.SupplyChain;

public enum ManufacturingStage { Draft, Confirmed, InProgress, Done, Cancelled }

/// <summary>A component line of a manufacturing order's bill of materials. Stored as JSON.</summary>
public sealed class BomComponent
{
    public string Product { get; set; } = default!;
    public decimal Quantity { get; set; } = 1;
    public string Uom { get; set; } = "Units";
    public bool Consumed { get; set; }
}

/// <summary>A manufacturing order — produce a finished product from its components.</summary>
public sealed class ManufacturingOrder : Entity<Guid>, IAggregateRoot
{
    public string Reference { get; private set; } = default!;
    public string Product { get; private set; } = default!;
    public decimal Quantity { get; private set; } = 1;
    public string Uom { get; private set; } = "Units";
    public ManufacturingStage Stage { get; private set; }
    public string? Responsible { get; private set; }
    public DateOnly ScheduledDate { get; private set; }
    public string? Source { get; private set; }
    public List<BomComponent> Components { get; private set; } = new();

    private ManufacturingOrder() { }

    public static ManufacturingOrder Create(Guid tenantId, string reference, string product, decimal quantity, DateOnly scheduled,
        ManufacturingStage stage = ManufacturingStage.Draft, string uom = "Units", string? responsible = null, string? source = null,
        IEnumerable<BomComponent>? components = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(product)) throw new ArgumentException("Product is required.", nameof(product));
        var mo = new ManufacturingOrder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Reference = reference.Trim(),
            Product = product.Trim(),
            Quantity = quantity <= 0 ? 1 : quantity,
            Uom = string.IsNullOrWhiteSpace(uom) ? "Units" : uom.Trim(),
            Stage = stage,
            Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim(),
            ScheduledDate = scheduled,
            Source = string.IsNullOrWhiteSpace(source) ? null : source.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        if (components is not null) mo.Components.AddRange(components);
        return mo;
    }

    public void MoveStage(ManufacturingStage stage, string? by) { Stage = stage; UpdatedAt = DateTime.UtcNow; UpdatedBy = by; }

    public void Update(string product, decimal quantity, string uom, string? responsible, DateOnly scheduled, IEnumerable<BomComponent>? components, string? by)
    {
        if (!string.IsNullOrWhiteSpace(product)) Product = product.Trim();
        Quantity = quantity <= 0 ? 1 : quantity;
        Uom = string.IsNullOrWhiteSpace(uom) ? "Units" : uom.Trim();
        Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim();
        ScheduledDate = scheduled;
        if (components is not null) { Components = components.ToList(); }
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}
