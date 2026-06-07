using Yugma.Crm.Domain.Hr.Fleet;
using Yugma.Crm.Domain.Hr.Referrals;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeReferralConfiguration : IEntityTypeConfiguration<EmployeeReferral>
{
    public void Configure(EntityTypeBuilder<EmployeeReferral> b)
    {
        b.ToTable("hr_referrals");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Referrer).HasMaxLength(200).IsRequired();
        b.Property(e => e.CandidateName).HasMaxLength(200).IsRequired();
        b.Property(e => e.CandidateEmail).HasMaxLength(256);
        b.Property(e => e.Position).HasMaxLength(150).IsRequired();
        b.Property(e => e.Department).HasMaxLength(100);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.BonusAmount).HasColumnType("numeric(12,2)");
        b.Property(e => e.Notes).HasMaxLength(500);
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> b)
    {
        b.ToTable("hr_vehicles");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Name).HasMaxLength(150).IsRequired();
        b.Property(e => e.Plate).HasMaxLength(20).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Plate }).IsUnique();
        b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.AssignedTo).HasMaxLength(200);
        b.Property(e => e.FuelType).HasMaxLength(20);
        b.Property(e => e.Notes).HasMaxLength(500);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
