using Yugma.Crm.Domain.Hr.Org;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ReportingAssignmentConfiguration : IEntityTypeConfiguration<ReportingAssignment>
{
    public void Configure(EntityTypeBuilder<ReportingAssignment> b)
    {
        b.ToTable("reporting_assignments");
        b.HasKey(e => e.Id);
        b.Property(e => e.EmployeeId).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.EmployeeId, e.EffectiveFrom });
        b.Property(e => e.Manager).HasMaxLength(200);
        b.Property(e => e.Department).HasMaxLength(100);
        b.Property(e => e.Team).HasMaxLength(100);
        b.Property(e => e.Project).HasMaxLength(150);
        b.Property(e => e.Reason).HasMaxLength(500);
        b.Property(e => e.ChangedBy).HasMaxLength(200);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
