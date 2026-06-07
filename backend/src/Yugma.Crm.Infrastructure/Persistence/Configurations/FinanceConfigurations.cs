using Yugma.Crm.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class FinanceDocumentConfiguration : IEntityTypeConfiguration<FinanceDocument>
{
    public void Configure(EntityTypeBuilder<FinanceDocument> b)
    {
        b.ToTable("finance_documents");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Number).HasMaxLength(32).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Number }).IsUnique();
        b.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Partner).HasMaxLength(200).IsRequired();
        b.Property(e => e.Reference).HasMaxLength(120);
        b.Property(e => e.Amount).HasColumnType("numeric(16,2)");
        b.Property(e => e.TaxAmount).HasColumnType("numeric(16,2)");
        b.Property(e => e.Total).HasColumnType("numeric(16,2)");
        b.Property(e => e.AmountPaid).HasColumnType("numeric(16,2)");
        b.Property(e => e.Notes);
        b.Ignore(e => e.AmountDue);
        b.HasIndex(e => new { e.TenantId, e.Kind, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> b)
    {
        b.ToTable("finance_expenses");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Number).HasMaxLength(32).IsRequired();
        b.Property(e => e.Employee).HasMaxLength(200).IsRequired();
        b.Property(e => e.Category).HasMaxLength(60).IsRequired();
        b.Property(e => e.Description).HasMaxLength(300).IsRequired();
        b.Property(e => e.Amount).HasColumnType("numeric(14,2)");
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Notes).HasMaxLength(500);
        b.HasIndex(e => new { e.TenantId, e.Status });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class BankAccountConfiguration : IEntityTypeConfiguration<BankAccount>
{
    public void Configure(EntityTypeBuilder<BankAccount> b)
    {
        b.ToTable("finance_bank_accounts");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Name).HasMaxLength(120).IsRequired();
        b.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Currency).HasMaxLength(8);
        b.Property(e => e.OpeningBalance).HasColumnType("numeric(16,2)");
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class BankTransactionConfiguration : IEntityTypeConfiguration<BankTransaction>
{
    public void Configure(EntityTypeBuilder<BankTransaction> b)
    {
        b.ToTable("finance_bank_transactions");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.AccountId).IsRequired();
        b.Property(e => e.Label).HasMaxLength(200).IsRequired();
        b.Property(e => e.Amount).HasColumnType("numeric(16,2)");
        b.Property(e => e.Category).HasMaxLength(20);
        b.HasIndex(e => new { e.TenantId, e.AccountId, e.Date });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class FinanceFileConfiguration : IEntityTypeConfiguration<FinanceFile>
{
    public void Configure(EntityTypeBuilder<FinanceFile> b)
    {
        b.ToTable("finance_files");
        b.HasKey(e => e.Id);
        b.Property(e => e.TenantId).IsRequired();
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Category).HasMaxLength(40).IsRequired();
        b.Property(e => e.Owner).HasMaxLength(200).IsRequired();
        b.Property(e => e.SignatureStatus).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Signer).HasMaxLength(200);
        b.HasIndex(e => new { e.TenantId, e.SignatureStatus });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
