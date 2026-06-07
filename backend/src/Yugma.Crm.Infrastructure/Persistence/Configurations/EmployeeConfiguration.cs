using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> b)
    {
        b.ToTable("employees");
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
            em.HasIndex(p => p.Value).IsUnique();
        });

        b.OwnsOne(e => e.Phone, ph =>
        {
            ph.Property(p => p.Value).HasColumnName("phone").HasMaxLength(32).IsRequired();
        });

        b.Property(e => e.Department).HasMaxLength(100).IsRequired();
        b.Property(e => e.Designation).HasMaxLength(150).IsRequired();
        b.Property(e => e.Location).HasMaxLength(100).IsRequired();
        b.Property(e => e.Manager).HasMaxLength(200);
        b.Property(e => e.ManagerId).HasColumnName("manager_id");
        b.Property(e => e.HrPartner).HasMaxLength(200);
        b.Property(e => e.HrPartnerId).HasColumnName("hr_partner_id");
        b.Property(e => e.Band).HasColumnName("band");
        b.HasIndex(e => new { e.TenantId, e.ManagerId });
        b.HasIndex(e => new { e.TenantId, e.HrPartnerId });
        b.Property(e => e.EmploymentType).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.JoinedAt).IsRequired();
        b.Property(e => e.CtcLakhs).HasColumnType("numeric(10,2)");
        b.Property(e => e.Performance).IsRequired();
        // Stores either an external URL or an uploaded photo as a base64 data URL → text column.
        b.Property(e => e.AvatarUrl).HasColumnName("avatar_url");

        b.Property(e => e.RowVersion).IsConcurrencyToken();

        var skillsConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<IReadOnlyList<string>, string[]>(
            v => v.ToArray(),
            v => v.ToList());
        b.Property<IReadOnlyList<string>>("Skills")
            .HasField("_skills")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasConversion(skillsConverter)
            .HasColumnType("text[]")
            .HasColumnName("skills");

        b.Ignore(e => e.DomainEvents);
    }
}
