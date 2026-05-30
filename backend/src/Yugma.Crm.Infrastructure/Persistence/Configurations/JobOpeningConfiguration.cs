using Yugma.Crm.Domain.Hr.Recruiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class JobOpeningConfiguration : IEntityTypeConfiguration<JobOpening>
{
    public void Configure(EntityTypeBuilder<JobOpening> b)
    {
        b.ToTable("job_openings");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title).HasMaxLength(150).IsRequired();
        b.Property(e => e.Department).HasMaxLength(100).IsRequired();
        b.Property(e => e.Location).HasMaxLength(100).IsRequired();
        b.Property(e => e.EmploymentType).HasMaxLength(30).IsRequired();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(e => e.HiringManager).HasMaxLength(200);
        b.Property(e => e.Priority).HasMaxLength(16);
        b.Property(e => e.BudgetCtcLakhs).HasColumnType("numeric(10,2)");
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
