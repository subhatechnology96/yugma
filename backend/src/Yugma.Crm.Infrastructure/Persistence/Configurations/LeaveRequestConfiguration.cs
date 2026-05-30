using Yugma.Crm.Domain.Hr.Leave;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> b)
    {
        b.ToTable("leave_requests");
        b.HasKey(e => e.Id);
        b.Property(e => e.Employee).HasMaxLength(200).IsRequired();
        b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Reason).HasMaxLength(1000).IsRequired();
        b.Property(e => e.Approver).HasMaxLength(200);
        b.Property(e => e.DecidedBy).HasMaxLength(200);
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.HasIndex(e => new { e.TenantId, e.Employee });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
