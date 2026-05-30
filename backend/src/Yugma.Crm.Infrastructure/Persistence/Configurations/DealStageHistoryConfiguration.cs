using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class DealStageHistoryConfiguration : IEntityTypeConfiguration<DealStageHistory>
{
    public void Configure(EntityTypeBuilder<DealStageHistory> b)
    {
        b.ToTable("crm_deal_stage_history");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.DealId).IsRequired();
        b.Property(e => e.FromStageId);
        b.Property(e => e.ToStageId).IsRequired();
        b.Property(e => e.ChangedAt).IsRequired();

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => e.DealId);
        b.Ignore(e => e.DomainEvents);
    }
}
