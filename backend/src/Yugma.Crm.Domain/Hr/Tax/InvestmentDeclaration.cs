using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Tax;

/// <summary>
/// One saved line of an employee's income-tax investment declaration for a financial year
/// (e.g. ItemKey "sec80c.elss" = 50000). Drives the Old-regime tax computation and Compare Tax.
/// </summary>
public sealed class InvestmentDeclaration : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public int Year { get; private set; }
    public string ItemKey { get; private set; } = default!;
    public decimal Amount { get; private set; }

    public static InvestmentDeclaration Create(Guid tenantId, Guid employeeId, int year, string itemKey, decimal amount) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Year = year,
            ItemKey = itemKey,
            Amount = amount,
            CreatedAt = DateTime.UtcNow
        };

    public void SetAmount(decimal amount, string? by)
    {
        Amount = amount;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
