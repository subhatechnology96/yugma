using Yugma.Crm.Domain.Hr.Recruiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class CandidateConfiguration : IEntityTypeConfiguration<Candidate>
{
    public void Configure(EntityTypeBuilder<Candidate> b)
    {
        b.ToTable("candidates");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Role).HasMaxLength(150).IsRequired();
        b.Property(e => e.Source).HasMaxLength(50).IsRequired();
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Email).HasMaxLength(256);
        b.Property(e => e.Location).HasMaxLength(100);
        b.Property(e => e.Owner).HasMaxLength(200);
        b.Property(e => e.ExpectedCtcLakhs).HasColumnType("numeric(10,2)");
        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
