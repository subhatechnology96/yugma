using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class DealConfiguration : IEntityTypeConfiguration<Deal>
{
    public void Configure(EntityTypeBuilder<Deal> b)
    {
        b.ToTable("crm_deals");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Code).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();

        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.AccountId).IsRequired();
        b.Property(e => e.ContactId);
        b.Property(e => e.Value).HasColumnType("numeric(16,2)");
        b.Property(e => e.StageId).IsRequired();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Probability).IsRequired();
        b.Property(e => e.CloseDate).IsRequired();
        b.Property(e => e.Owner).HasMaxLength(200).IsRequired();
        b.Property(e => e.LastActivityAt);

        b.Property(e => e.RowVersion).IsConcurrencyToken();

        b.HasMany(e => e.StageHistory)
            .WithOne()
            .HasForeignKey(h => h.DealId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Navigation(e => e.StageHistory).UsePropertyAccessMode(PropertyAccessMode.Field);

        b.HasIndex(e => new { e.TenantId, e.StageId });
        b.HasIndex(e => new { e.TenantId, e.AccountId });
        b.Ignore(e => e.DomainEvents);
    }
}
