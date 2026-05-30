using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> b)
    {
        b.ToTable("invoices");
        b.HasKey(e => e.Id);
        b.Property(e => e.Number).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Number }).IsUnique();
        b.Property(e => e.Customer).HasMaxLength(200).IsRequired();
        b.Property(e => e.Amount).HasColumnType("numeric(14,2)");
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
