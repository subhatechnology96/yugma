using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> b)
    {
        b.ToTable("crm_accounts");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Industry).HasMaxLength(120);
        b.Property(e => e.Website).HasMaxLength(256);
        b.Property(e => e.Phone).HasMaxLength(32);
        b.Property(e => e.Size).HasMaxLength(40);
        b.Property(e => e.AnnualRevenue).HasColumnType("numeric(16,2)");
        b.Property(e => e.Owner).HasMaxLength(200).IsRequired();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.CustomerRef);

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => new { e.TenantId, e.Name });
        b.Ignore(e => e.DomainEvents);
    }
}
