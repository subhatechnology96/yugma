using Yugma.Crm.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.ToTable("audit_logs");
        b.HasKey(e => e.Id);
        b.Property(e => e.At).IsRequired();
        b.Property(e => e.Who).HasMaxLength(200).IsRequired();
        b.Property(e => e.Action).HasMaxLength(150).IsRequired();
        b.Property(e => e.Resource).HasMaxLength(300).IsRequired();
        b.Property(e => e.Ip).HasMaxLength(64);
        b.Property(e => e.Outcome).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(e => new { e.TenantId, e.At });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
