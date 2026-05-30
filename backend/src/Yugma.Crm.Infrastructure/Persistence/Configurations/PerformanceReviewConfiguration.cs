using Yugma.Crm.Domain.Hr.Performance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> b)
    {
        b.ToTable("performance_reviews");
        b.HasKey(e => e.Id);
        b.Property(e => e.EmployeeId).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.EmployeeId, e.Year, e.Quarter }).IsUnique();
        b.Property(e => e.Rating).HasColumnType("numeric(3,1)");
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.Reviewer).HasMaxLength(200);
        b.Property(e => e.Summary).HasMaxLength(1000);
        b.Property(e => e.Competencies).HasMaxLength(64).IsRequired();
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
