using Yugma.Crm.Domain.Hr.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class EmployeeDocumentConfiguration : IEntityTypeConfiguration<EmployeeDocument>
{
    public void Configure(EntityTypeBuilder<EmployeeDocument> b)
    {
        b.ToTable("employee_documents");
        b.HasKey(e => e.Id);

        b.Property(e => e.EmployeeId).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.EmployeeId });

        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Category).HasMaxLength(40).IsRequired();
        b.Property(e => e.FileType).HasMaxLength(16).IsRequired();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(e => e.UploadedBy).HasMaxLength(120);

        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
