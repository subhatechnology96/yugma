using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> b)
    {
        b.ToTable("crm_leads");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Code).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();

        b.OwnsOne(e => e.Name, n =>
        {
            n.Property(p => p.First).HasColumnName("first_name").HasMaxLength(100).IsRequired();
            n.Property(p => p.Last).HasColumnName("last_name").HasMaxLength(100).IsRequired();
        });
        b.OwnsOne(e => e.Email, em =>
        {
            em.Property(p => p.Value).HasColumnName("email").HasMaxLength(256).IsRequired();
        });
        b.OwnsOne(e => e.Phone, ph =>
        {
            ph.Property(p => p.Value).HasColumnName("phone").HasMaxLength(32).IsRequired();
        });

        b.Property(e => e.Company).HasMaxLength(200).IsRequired();
        b.Property(e => e.Source).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Score).IsRequired();
        b.Property(e => e.Owner).HasMaxLength(200).IsRequired();

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Ignore(e => e.DomainEvents);
    }
}
