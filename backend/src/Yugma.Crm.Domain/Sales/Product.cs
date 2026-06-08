using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Sales;

/// <summary>A sellable product or service in the sales catalog.</summary>
public sealed class Product : Entity<Guid>, IAggregateRoot
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string Category { get; private set; } = "All";
    public decimal UnitPrice { get; private set; }
    public decimal TaxPercent { get; private set; } = 18;
    public decimal OnHand { get; private set; }
    public string Uom { get; private set; } = "Units";
    public string? Description { get; private set; }
    public bool Active { get; private set; } = true;

    private Product() { } // EF

    public static Product Create(
        Guid tenantId, string code, string name, decimal unitPrice, string category = "All",
        decimal taxPercent = 18, decimal onHand = 0, string uom = "Units", string? description = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        return new Product
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim(),
            Name = name.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "All" : category.Trim(),
            UnitPrice = unitPrice < 0 ? 0 : unitPrice,
            TaxPercent = taxPercent < 0 ? 0 : taxPercent,
            OnHand = onHand,
            Uom = string.IsNullOrWhiteSpace(uom) ? "Units" : uom.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Active = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(string name, string category, decimal unitPrice, decimal taxPercent, decimal onHand, string uom, string? description, bool active, string? by)
    {
        if (!string.IsNullOrWhiteSpace(name)) Name = name.Trim();
        Category = string.IsNullOrWhiteSpace(category) ? "All" : category.Trim();
        UnitPrice = unitPrice < 0 ? 0 : unitPrice;
        TaxPercent = taxPercent < 0 ? 0 : taxPercent;
        OnHand = onHand;
        Uom = string.IsNullOrWhiteSpace(uom) ? "Units" : uom.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Active = active;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
