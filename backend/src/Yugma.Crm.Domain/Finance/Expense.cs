using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Finance;

public enum ExpenseStatus { Draft, Submitted, Approved, Reimbursed, Refused }

/// <summary>An employee expense claim that flows Draft → Submitted → Approved → Reimbursed (or Refused).</summary>
public sealed class Expense : Entity<Guid>, IAggregateRoot
{
    public string Number { get; private set; } = default!;
    public string Employee { get; private set; } = default!;
    public string Category { get; private set; } = default!;          // Travel, Meals, Accommodation, …
    public string Description { get; private set; } = default!;
    public DateOnly Date { get; private set; }
    public decimal Amount { get; private set; }
    public ExpenseStatus Status { get; private set; }
    public string? Notes { get; private set; }

    private Expense() { } // EF

    public static Expense Create(
        Guid tenantId, string number, string employee, string category, string description, DateOnly date,
        decimal amount, ExpenseStatus status = ExpenseStatus.Draft, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(employee)) throw new ArgumentException("Employee is required.", nameof(employee));
        if (amount < 0) throw new ArgumentException("Amount cannot be negative.", nameof(amount));
        return new Expense
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Number = number.Trim(),
            Employee = employee.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "Other" : category.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? category : description.Trim(),
            Date = date,
            Amount = amount,
            Status = status,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Submit(string? by) { if (Status == ExpenseStatus.Draft) Status = ExpenseStatus.Submitted; Touch(by); }
    public void Approve(string? by) { if (Status is ExpenseStatus.Submitted or ExpenseStatus.Draft) Status = ExpenseStatus.Approved; Touch(by); }
    public void Refuse(string? by, string? reason) { Status = ExpenseStatus.Refused; Notes = string.IsNullOrWhiteSpace(reason) ? Notes : reason.Trim(); Touch(by); }
    public void Reimburse(string? by) { if (Status == ExpenseStatus.Approved) Status = ExpenseStatus.Reimbursed; Touch(by); }

    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
