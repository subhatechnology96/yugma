using Yugma.Crm.Domain.SupplyChain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class StockItemConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> b)
    {
        b.ToTable("sc_stock_items");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Sku).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Sku }).IsUnique();
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Category).HasMaxLength(80);
        b.Property(e => e.Location).HasMaxLength(80);
        b.Property(e => e.OnHand).HasColumnType("numeric(14,2)");
        b.Property(e => e.Reserved).HasColumnType("numeric(14,2)");
        b.Property(e => e.ReorderPoint).HasColumnType("numeric(14,2)");
        b.Property(e => e.UnitCost).HasColumnType("numeric(14,2)");
        b.Property(e => e.Uom).HasMaxLength(24);
        b.Ignore(e => e.Forecast);
        b.HasIndex(e => new { e.TenantId, e.Category });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class StockMoveConfiguration : IEntityTypeConfiguration<StockMove>
{
    public void Configure(EntityTypeBuilder<StockMove> b)
    {
        b.ToTable("sc_stock_moves");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Reference).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Reference }).IsUnique();
        b.Property(e => e.MoveType).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Product).HasMaxLength(200).IsRequired();
        b.Property(e => e.Quantity).HasColumnType("numeric(14,2)");
        b.Property(e => e.SourceLocation).HasMaxLength(80);
        b.Property(e => e.DestLocation).HasMaxLength(80);
        b.Property(e => e.Partner).HasMaxLength(200);
        b.HasIndex(e => new { e.TenantId, e.MoveType, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class ManufacturingOrderConfiguration : IEntityTypeConfiguration<ManufacturingOrder>
{
    public void Configure(EntityTypeBuilder<ManufacturingOrder> b)
    {
        b.ToTable("sc_manufacturing_orders");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Reference).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Reference }).IsUnique();
        b.Property(e => e.Product).HasMaxLength(200).IsRequired();
        b.Property(e => e.Quantity).HasColumnType("numeric(14,2)");
        b.Property(e => e.Uom).HasMaxLength(24);
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Responsible).HasMaxLength(160);
        b.Property(e => e.Source).HasMaxLength(80);
        b.OwnsMany(e => e.Components, o => o.ToJson());
        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class EngineeringChangeConfiguration : IEntityTypeConfiguration<EngineeringChange>
{
    public void Configure(EntityTypeBuilder<EngineeringChange> b)
    {
        b.ToTable("sc_engineering_changes");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Reference).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Reference }).IsUnique();
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Product).HasMaxLength(200);
        b.Property(e => e.ChangeType).HasConversion<string>().HasMaxLength(24);
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Responsible).HasMaxLength(160);
        b.Property(e => e.Description);
        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> b)
    {
        b.ToTable("sc_purchase_orders");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Number).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Number }).IsUnique();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Vendor).HasMaxLength(200).IsRequired();
        b.Property(e => e.VendorEmail).HasMaxLength(160);
        b.Property(e => e.Responsible).HasMaxLength(160);
        b.Property(e => e.Notes);
        b.Property(e => e.UntaxedAmount).HasColumnType("numeric(16,2)");
        b.Property(e => e.TaxAmount).HasColumnType("numeric(16,2)");
        b.Property(e => e.Total).HasColumnType("numeric(16,2)");
        b.OwnsMany(e => e.Lines, o => o.ToJson());
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class MaintenanceRequestConfiguration : IEntityTypeConfiguration<MaintenanceRequest>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequest> b)
    {
        b.ToTable("sc_maintenance_requests");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Reference).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Reference }).IsUnique();
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Equipment).HasMaxLength(200).IsRequired();
        b.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Responsible).HasMaxLength(160);
        b.Property(e => e.Category).HasMaxLength(80);
        b.Property(e => e.Duration).HasColumnType("numeric(8,2)");
        b.Property(e => e.Description);
        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class QualityCheckConfiguration : IEntityTypeConfiguration<QualityCheck>
{
    public void Configure(EntityTypeBuilder<QualityCheck> b)
    {
        b.ToTable("sc_quality_checks");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Reference).HasMaxLength(40).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Reference }).IsUnique();
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Product).HasMaxLength(200);
        b.Property(e => e.CheckType).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.ControlPoint).HasMaxLength(80);
        b.Property(e => e.SourceDocument).HasMaxLength(80);
        b.Property(e => e.Responsible).HasMaxLength(160);
        b.Property(e => e.Measure).HasMaxLength(120);
        b.Property(e => e.Notes);
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
