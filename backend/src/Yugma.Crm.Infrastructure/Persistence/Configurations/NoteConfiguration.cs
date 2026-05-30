using Yugma.Crm.Domain.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> b)
    {
        b.ToTable("crm_notes");
        b.HasKey(e => e.Id);

        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Body).HasMaxLength(4000).IsRequired();
        b.Property(e => e.RelatedToType).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.RelatedToId).IsRequired();
        b.Property(e => e.Author).HasMaxLength(200).IsRequired();

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => new { e.TenantId, e.RelatedToType, e.RelatedToId });
        b.Ignore(e => e.DomainEvents);
    }
}
