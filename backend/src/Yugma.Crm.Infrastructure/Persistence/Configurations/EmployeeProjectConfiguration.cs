using Yugma.Crm.Domain.Hr.Career;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeProjectConfiguration : IEntityTypeConfiguration<EmployeeProject>
{
    public void Configure(EntityTypeBuilder<EmployeeProject> b)
    {
        b.ToTable("employee_projects");
        b.HasKey(e => e.Id);
        b.Property(e => e.EmployeeId).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.EmployeeId });
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Domain).HasMaxLength(80).IsRequired();
        b.Property(e => e.Role).HasMaxLength(120).IsRequired();
        b.Property(e => e.Manager).HasMaxLength(200);
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.Responsibilities).HasMaxLength(2000);
        b.Property(e => e.Outcome).HasMaxLength(1000);
        b.Property(e => e.Feedback).HasMaxLength(1000);
        b.Property(e => e.Skills).HasMaxLength(500);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
