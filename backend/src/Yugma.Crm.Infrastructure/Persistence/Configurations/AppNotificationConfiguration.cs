using Yugma.Crm.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AppNotificationConfiguration : IEntityTypeConfiguration<AppNotification>
{
    public void Configure(EntityTypeBuilder<AppNotification> b)
    {
        b.ToTable("notifications");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Message).HasMaxLength(1000).IsRequired();
        b.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Link).HasMaxLength(300);
        b.Property(e => e.RecipientEmail).HasMaxLength(256);
        b.Property(e => e.Audience).HasMaxLength(40);
        b.HasIndex(e => new { e.TenantId, e.CreatedAtUtc });
        b.HasIndex(e => e.RecipientEmail);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
