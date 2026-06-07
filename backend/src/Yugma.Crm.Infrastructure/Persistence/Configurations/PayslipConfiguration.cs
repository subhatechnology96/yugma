using Yugma.Crm.Domain.Hr.Payroll;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class PayslipConfiguration : IEntityTypeConfiguration<Payslip>
{
    public void Configure(EntityTypeBuilder<Payslip> b)
    {
        b.ToTable("payslips");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.RunId).IsRequired();
        b.Property(e => e.EmployeeName).HasMaxLength(200).IsRequired();
        b.Property(e => e.Code).HasMaxLength(32).IsRequired();
        b.Property(e => e.Department).HasMaxLength(100);
        b.Property(e => e.Designation).HasMaxLength(150);
        b.Property(e => e.Notes).HasMaxLength(500);

        foreach (var col in new[] { nameof(Payslip.Basic), nameof(Payslip.Hra), nameof(Payslip.Special), nameof(Payslip.Conveyance),
            nameof(Payslip.Bonus), nameof(Payslip.OtherEarnings), nameof(Payslip.Pf), nameof(Payslip.Esi), nameof(Payslip.Pt),
            nameof(Payslip.Tds), nameof(Payslip.OtherDeductions), nameof(Payslip.LopDeduction), nameof(Payslip.Gross),
            nameof(Payslip.TotalDeductions), nameof(Payslip.Net) })
            b.Property(col).HasColumnType("numeric(14,2)");

        b.HasIndex(e => new { e.TenantId, e.RunId });
        b.HasIndex(e => new { e.RunId, e.EmployeeId }).IsUnique();
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.FixedMonthly);
        b.Ignore(e => e.DomainEvents);
    }
}
