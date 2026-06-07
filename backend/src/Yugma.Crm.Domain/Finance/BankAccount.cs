using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Finance;

public enum BankAccountKind { Bank, Cash }

/// <summary>A bank or cash journal. Its running balance is the opening balance plus its transactions.</summary>
public sealed class BankAccount : Entity<Guid>, IAggregateRoot
{
    public string Name { get; private set; } = default!;
    public BankAccountKind Kind { get; private set; }
    public string Currency { get; private set; } = "USD";
    public decimal OpeningBalance { get; private set; }

    private BankAccount() { } // EF

    public static BankAccount Create(Guid tenantId, string name, BankAccountKind kind, decimal openingBalance, string currency = "USD", string? createdBy = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Kind = kind,
            Currency = currency,
            OpeningBalance = openingBalance,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
}

/// <summary>A single line on a bank/cash statement. Category buckets it for the dashboard (payment | misc | transfer).</summary>
public sealed class BankTransaction : Entity<Guid>, IAggregateRoot
{
    public Guid AccountId { get; private set; }
    public DateOnly Date { get; private set; }
    public string Label { get; private set; } = default!;
    public decimal Amount { get; private set; }                       // +inflow / -outflow
    public string Category { get; private set; } = "misc";            // payment | misc | transfer
    public bool Reconciled { get; private set; }

    private BankTransaction() { } // EF

    public static BankTransaction Create(Guid tenantId, Guid accountId, DateOnly date, string label, decimal amount, string category, bool reconciled, string? createdBy = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AccountId = accountId,
            Date = date,
            Label = label.Trim(),
            Amount = amount,
            Category = string.IsNullOrWhiteSpace(category) ? "misc" : category.Trim().ToLowerInvariant(),
            Reconciled = reconciled,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };

    public void Reconcile(string? by) { Reconciled = true; UpdatedAt = DateTime.UtcNow; UpdatedBy = by; }
}
