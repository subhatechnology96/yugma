using Yugma.Crm.Domain.Hr.Profile;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeProfileConfiguration : IEntityTypeConfiguration<EmployeeProfile>
{
    public void Configure(EntityTypeBuilder<EmployeeProfile> b)
    {
        b.ToTable("employee_profiles");
        b.HasKey(e => e.Id);
        b.HasIndex(e => new { e.TenantId, e.EmployeeId }).IsUnique();
        b.Property(e => e.PersonalEmail).HasMaxLength(256);
        b.Property(e => e.Worksite).HasMaxLength(20);
        b.Property(e => e.Grade).HasMaxLength(10);
        b.Property(e => e.BloodGroup).HasMaxLength(8);
        b.Property(e => e.MaritalStatus).HasMaxLength(20);
        b.Property(e => e.Address).HasMaxLength(300);
        b.Property(e => e.EmergencyName).HasMaxLength(120);
        b.Property(e => e.EmergencyRelation).HasMaxLength(40);
        b.Property(e => e.EmergencyPhone).HasMaxLength(40);
        b.Property(e => e.PanMasked).HasMaxLength(20);
        b.Property(e => e.AadhaarMasked).HasMaxLength(30);
        b.Property(e => e.BankName).HasMaxLength(80);
        b.Property(e => e.BankAccountMasked).HasMaxLength(30);
        b.Property(e => e.Uan).HasMaxLength(30);
        b.Property(e => e.About).HasMaxLength(1000);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
