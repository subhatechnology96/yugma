using Yugma.Crm.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ServiceOrderConfiguration : IEntityTypeConfiguration<ServiceOrder>
{
    public void Configure(EntityTypeBuilder<ServiceOrder> b)
    {
        b.ToTable("service_orders");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Code).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Priority).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Customer).HasMaxLength(200).IsRequired();
        b.Property(e => e.AssignedTo).HasMaxLength(200);
        b.Property(e => e.ScheduledAt);
        b.Property(e => e.DueAt);
        b.Property(e => e.EstimatedHours).HasColumnType("numeric(8,2)");
        b.Property(e => e.Description);

        var tagsConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<IReadOnlyList<string>, string[]>(
            v => v.ToArray(), v => v.ToList());
        b.Property<IReadOnlyList<string>>("Tags")
            .HasField("_tags")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasConversion(tagsConverter)
            .HasColumnType("text[]")
            .HasColumnName("tags");

        b.OwnsMany(e => e.Activity, o => o.ToJson());

        b.HasIndex(e => new { e.TenantId, e.Type, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
