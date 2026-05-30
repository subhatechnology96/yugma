using Yugma.Crm.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.ToTable("app_users");
        b.HasKey(e => e.Id);
        b.Property(e => e.FullName).HasMaxLength(200).IsRequired();
        b.Property(e => e.Email).HasMaxLength(256).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Email }).IsUnique();
        b.Property(e => e.Role).HasMaxLength(50).IsRequired();
        b.Property(e => e.JobTitle).HasMaxLength(120);
        b.Property(e => e.Department).HasMaxLength(120);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.PasswordHash).HasColumnName("password_hash");
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
