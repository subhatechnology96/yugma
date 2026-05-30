using Yugma.Crm.Domain.Hr.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceRecordConfiguration : IEntityTypeConfiguration<AttendanceRecord>
{
    public void Configure(EntityTypeBuilder<AttendanceRecord> b)
    {
        b.ToTable("attendance_records");
        b.HasKey(e => e.Id);
        b.Property(e => e.EmployeeName).HasMaxLength(200).IsRequired();
        b.Property(e => e.Department).HasMaxLength(100).IsRequired();
        b.Property(e => e.InTime).HasMaxLength(10);
        b.Property(e => e.OutTime).HasMaxLength(10);
        b.Property(e => e.Hours).HasColumnType("numeric(5,2)");
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.EmployeeId).HasColumnName("employee_id");
        b.HasIndex(e => new { e.TenantId, e.Date });
        b.HasIndex(e => new { e.TenantId, e.Date, e.EmployeeId });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
