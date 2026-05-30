using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> b)
    {
        b.ToTable("crm_activities");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Subject).HasMaxLength(300).IsRequired();
        b.Property(e => e.DueAt).IsRequired();
        b.Property(e => e.CompletedAt);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.RelatedToType).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.RelatedToId).IsRequired();
        b.Property(e => e.Owner).HasMaxLength(200).IsRequired();
        b.Property(e => e.ReminderAt);

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => new { e.TenantId, e.RelatedToType, e.RelatedToId });
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Ignore(e => e.DomainEvents);
    }
}
