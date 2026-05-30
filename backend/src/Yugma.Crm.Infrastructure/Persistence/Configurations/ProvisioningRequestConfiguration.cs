using Yugma.Crm.Domain.Provisioning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ProvisioningRequestConfiguration : IEntityTypeConfiguration<ProvisioningRequest>
{
    public void Configure(EntityTypeBuilder<ProvisioningRequest> b)
    {
        b.ToTable("provisioning_requests");
        b.HasKey(e => e.Id);
        b.Property(e => e.EmployeeId).IsRequired();
        b.Property(e => e.EmployeeName).HasMaxLength(200).IsRequired();
        b.Property(e => e.Email).HasMaxLength(256).IsRequired();
        b.Property(e => e.Department).HasMaxLength(100).IsRequired();
        b.Property(e => e.Designation).HasMaxLength(150).IsRequired();
        b.Property(e => e.Location).HasMaxLength(100).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.AssignedTo).HasMaxLength(120);
        b.Property(e => e.Notes).HasMaxLength(2000);
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.HasIndex(e => new { e.TenantId, e.RequestedAtUtc });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
