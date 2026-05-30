using Yugma.Crm.Domain.Hr.Tax;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class InvestmentDeclarationConfiguration : IEntityTypeConfiguration<InvestmentDeclaration>
{
    public void Configure(EntityTypeBuilder<InvestmentDeclaration> b)
    {
        b.ToTable("investment_declarations");
        b.HasKey(e => e.Id);
        b.Property(e => e.ItemKey).HasMaxLength(60).IsRequired();
        b.Property(e => e.Amount).HasColumnType("numeric(14,2)");
        b.HasIndex(e => new { e.TenantId, e.EmployeeId, e.Year, e.ItemKey }).IsUnique();
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
