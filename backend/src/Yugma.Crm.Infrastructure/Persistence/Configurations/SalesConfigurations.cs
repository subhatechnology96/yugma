using Yugma.Crm.Domain.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class OpportunityConfiguration : IEntityTypeConfiguration<Opportunity>
{
    public void Configure(EntityTypeBuilder<Opportunity> b)
    {
        b.ToTable("sales_opportunities");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Code).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Customer).HasMaxLength(200).IsRequired();
        b.Property(e => e.ContactName).HasMaxLength(160);
        b.Property(e => e.Email).HasMaxLength(160);
        b.Property(e => e.Phone).HasMaxLength(40);
        b.Property(e => e.Salesperson).HasMaxLength(160);
        b.Property(e => e.ExpectedRevenue).HasColumnType("numeric(16,2)");
        b.Property(e => e.Probability).HasColumnType("numeric(5,2)");
        b.Property(e => e.Priority);
        b.Property(e => e.ExpectedClosing);
        b.Property(e => e.Source).HasMaxLength(60);
        b.Property(e => e.Description);

        var tagsConverter = new ValueConverter<IReadOnlyList<string>, string[]>(v => v.ToArray(), v => v.ToList());
        b.Property<IReadOnlyList<string>>("Tags")
            .HasField("_tags")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasConversion(tagsConverter)
            .HasColumnType("text[]")
            .HasColumnName("tags");

        b.OwnsMany(e => e.Activities, o => o.ToJson());

        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.ToTable("sales_products");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Code).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Category).HasMaxLength(80);
        b.Property(e => e.UnitPrice).HasColumnType("numeric(14,2)");
        b.Property(e => e.TaxPercent).HasColumnType("numeric(5,2)");
        b.Property(e => e.OnHand).HasColumnType("numeric(12,2)");
        b.Property(e => e.Uom).HasMaxLength(24);
        b.Property(e => e.Description);
        b.Property(e => e.Active);
        b.HasIndex(e => new { e.TenantId, e.Category });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class QuotationConfiguration : IEntityTypeConfiguration<Quotation>
{
    public void Configure(EntityTypeBuilder<Quotation> b)
    {
        b.ToTable("sales_quotations");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Number).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Number }).IsUnique();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Customer).HasMaxLength(200).IsRequired();
        b.Property(e => e.CustomerEmail).HasMaxLength(160);
        b.Property(e => e.CustomerAddress).HasMaxLength(400);
        b.Property(e => e.OrderDate);
        b.Property(e => e.ExpiryDate);
        b.Property(e => e.Pricelist).HasMaxLength(40);
        b.Property(e => e.PaymentTerms).HasMaxLength(60);
        b.Property(e => e.Salesperson).HasMaxLength(160);
        b.Property(e => e.OpportunityId);
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
