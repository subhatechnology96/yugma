using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.SupplyChain;

/// <summary>A stock-tracked item in a warehouse location.</summary>
public sealed class StockItem : Entity<Guid>, IAggregateRoot
{
    public string Sku { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string Category { get; private set; } = "All";
    public string Location { get; private set; } = "WH/Stock";
    public decimal OnHand { get; private set; }
    public decimal Reserved { get; private set; }
    public decimal ReorderPoint { get; private set; }
    public decimal UnitCost { get; private set; }
    public string Uom { get; private set; } = "Units";

    public decimal Forecast => OnHand - Reserved;

    private StockItem() { }

    public static StockItem Create(Guid tenantId, string sku, string name, string category, string location,
        decimal onHand, decimal reserved, decimal reorderPoint, decimal unitCost, string uom = "Units", string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        return new StockItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Sku = sku.Trim(),
            Name = name.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "All" : category.Trim(),
            Location = string.IsNullOrWhiteSpace(location) ? "WH/Stock" : location.Trim(),
            OnHand = onHand,
            Reserved = reserved < 0 ? 0 : reserved,
            ReorderPoint = reorderPoint < 0 ? 0 : reorderPoint,
            UnitCost = unitCost < 0 ? 0 : unitCost,
            Uom = string.IsNullOrWhiteSpace(uom) ? "Units" : uom.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(string name, string category, string location, decimal onHand, decimal reserved, decimal reorderPoint, decimal unitCost, string uom, string? by)
    {
        if (!string.IsNullOrWhiteSpace(name)) Name = name.Trim();
        Category = string.IsNullOrWhiteSpace(category) ? "All" : category.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? "WH/Stock" : location.Trim();
        OnHand = onHand;
        Reserved = reserved < 0 ? 0 : reserved;
        ReorderPoint = reorderPoint < 0 ? 0 : reorderPoint;
        UnitCost = unitCost < 0 ? 0 : unitCost;
        Uom = string.IsNullOrWhiteSpace(uom) ? "Units" : uom.Trim();
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}

/// <summary>Type of stock move: incoming receipt, outgoing delivery, or internal transfer.</summary>
public enum StockMoveType { Receipt, Delivery, Internal, Manufacturing }
public enum StockMoveStatus { Draft, Ready, Done, Cancelled }

/// <summary>A movement of goods (receipt / delivery / internal transfer).</summary>
public sealed class StockMove : Entity<Guid>, IAggregateRoot
{
    public string Reference { get; private set; } = default!;
    public StockMoveType MoveType { get; private set; }
    public StockMoveStatus Status { get; private set; }
    public string Product { get; private set; } = default!;
    public decimal Quantity { get; private set; }
    public string SourceLocation { get; private set; } = default!;
    public string DestLocation { get; private set; } = default!;
    public string? Partner { get; private set; }
    public DateOnly ScheduledDate { get; private set; }

    private StockMove() { }

    public static StockMove Create(Guid tenantId, string reference, StockMoveType type, string product, decimal quantity,
        string source, string dest, DateOnly scheduled, StockMoveStatus status = StockMoveStatus.Draft, string? partner = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(product)) throw new ArgumentException("Product is required.", nameof(product));
        return new StockMove
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Reference = reference.Trim(),
            MoveType = type,
            Status = status,
            Product = product.Trim(),
            Quantity = quantity < 0 ? 0 : quantity,
            SourceLocation = source.Trim(),
            DestLocation = dest.Trim(),
            Partner = string.IsNullOrWhiteSpace(partner) ? null : partner.Trim(),
            ScheduledDate = scheduled,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void SetStatus(StockMoveStatus status, string? by) { Status = status; UpdatedAt = DateTime.UtcNow; UpdatedBy = by; }
}
