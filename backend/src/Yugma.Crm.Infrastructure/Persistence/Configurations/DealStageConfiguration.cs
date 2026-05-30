using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class DealStageConfiguration : IEntityTypeConfiguration<DealStage>
{
    public void Configure(EntityTypeBuilder<DealStage> b)
    {
        b.ToTable("crm_deal_stages");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Name).HasMaxLength(100).IsRequired();
        b.Property(e => e.Order).IsRequired();
        b.Property(e => e.Probability).IsRequired();
        b.Property(e => e.IsWon).IsRequired();
        b.Property(e => e.IsLost).IsRequired();

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => new { e.TenantId, e.Name }).IsUnique();
        b.Ignore(e => e.DomainEvents);
    }
}
