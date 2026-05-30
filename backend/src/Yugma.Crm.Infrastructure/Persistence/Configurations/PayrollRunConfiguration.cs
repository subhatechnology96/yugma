using Yugma.Crm.Domain.Hr.Payroll;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class PayrollRunConfiguration : IEntityTypeConfiguration<PayrollRun>
{
    public void Configure(EntityTypeBuilder<PayrollRun> b)
    {
        b.ToTable("payroll_runs");
        b.HasKey(e => e.Id);
        b.Property(e => e.Cycle).HasMaxLength(20).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Cycle }).IsUnique();
        b.Property(e => e.Total).HasColumnType("numeric(14,2)");
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
