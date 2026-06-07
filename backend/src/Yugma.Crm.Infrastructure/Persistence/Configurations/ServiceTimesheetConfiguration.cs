using Yugma.Crm.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ServiceTimesheetConfiguration : IEntityTypeConfiguration<ServiceTimesheet>
{
    public void Configure(EntityTypeBuilder<ServiceTimesheet> b)
    {
        b.ToTable("service_timesheets");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.OrderId).IsRequired();
        b.Property(e => e.Person).HasMaxLength(200).IsRequired();
        b.Property(e => e.Date).IsRequired();
        b.Property(e => e.Hours).HasColumnType("numeric(6,2)");
        b.Property(e => e.Note).HasMaxLength(500);

        b.HasIndex(e => new { e.TenantId, e.OrderId });
        b.HasIndex(e => new { e.TenantId, e.Person, e.Date });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
