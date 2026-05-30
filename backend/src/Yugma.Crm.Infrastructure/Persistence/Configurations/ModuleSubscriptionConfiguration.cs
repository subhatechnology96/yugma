using Yugma.Crm.Domain.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ModuleSubscriptionConfiguration : IEntityTypeConfiguration<ModuleSubscription>
{
    public void Configure(EntityTypeBuilder<ModuleSubscription> b)
    {
        b.ToTable("module_subscriptions");
        b.HasKey(e => e.Id);
        b.Property(e => e.ModuleKey).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.ModuleKey }).IsUnique();
        b.Property(e => e.ModuleName).HasMaxLength(80).IsRequired();
        b.Property(e => e.Description).HasMaxLength(500).IsRequired();
        b.Property(e => e.Icon).HasMaxLength(40).IsRequired();
        b.Property(e => e.Plan).HasMaxLength(20).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.BillingCycle).HasMaxLength(10).IsRequired();
        b.Property(e => e.MonthlyPrice).HasColumnType("numeric(12,2)");
        b.Property(e => e.Features).HasColumnType("text[]").IsRequired();
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
