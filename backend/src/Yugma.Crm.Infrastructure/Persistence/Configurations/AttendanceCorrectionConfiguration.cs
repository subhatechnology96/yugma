using Yugma.Crm.Domain.Hr.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceCorrectionConfiguration : IEntityTypeConfiguration<AttendanceCorrection>
{
    public void Configure(EntityTypeBuilder<AttendanceCorrection> b)
    {
        b.ToTable("attendance_corrections");
        b.HasKey(e => e.Id);
        b.Property(e => e.EmployeeName).HasMaxLength(200).IsRequired();
        b.Property(e => e.RequestedStatus).HasMaxLength(20).IsRequired();
        b.Property(e => e.RequestedInTime).HasMaxLength(5);
        b.Property(e => e.RequestedOutTime).HasMaxLength(5);
        b.Property(e => e.Reason).HasMaxLength(1000).IsRequired();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Approver).HasMaxLength(200);
        b.Property(e => e.DecidedBy).HasMaxLength(200);
        b.Property(e => e.DecisionNote).HasMaxLength(1000);
        b.HasIndex(e => new { e.TenantId, e.EmployeeId, e.Date });
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
