using Yugma.Crm.Domain.Hr.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AttendanceOverrideConfiguration : IEntityTypeConfiguration<AttendanceOverride>
{
    public void Configure(EntityTypeBuilder<AttendanceOverride> b)
    {
        b.ToTable("attendance_overrides");
        b.HasKey(e => e.Id);

        b.Property(e => e.EmployeeId).IsRequired();
        b.Property(e => e.Date).IsRequired();
        // One manual correction per employee per day.
        b.HasIndex(e => new { e.TenantId, e.EmployeeId, e.Date }).IsUnique();

        b.Property(e => e.Status).HasMaxLength(16).IsRequired();
        b.Property(e => e.InTime).HasMaxLength(8);
        b.Property(e => e.OutTime).HasMaxLength(8);

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
