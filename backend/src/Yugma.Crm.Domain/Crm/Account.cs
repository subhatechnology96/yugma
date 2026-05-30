using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm;

public sealed class Account : Entity<Guid>, IAggregateRoot
{
    public string Name { get; private set; } = default!;
    public string? Industry { get; private set; }
    public string? Website { get; private set; }
    public string? Phone { get; private set; }
    public string? Size { get; private set; }
    public decimal AnnualRevenue { get; private set; }
    public string Owner { get; private set; } = default!;
    public AccountStatus Status { get; private set; }

    // Integration point with Master Data Customers. No Customer aggregate exists yet
    // (finance tracks customers as free text on Invoice), so this stays a nullable reference.
    public Guid? CustomerRef { get; private set; }

    private Account() { } // EF

    public static Account Create(
        Guid tenantId,
        string name,
        string? industry,
        string? website,
        string? phone,
        string? size,
        decimal annualRevenue,
        string owner,
        AccountStatus status = AccountStatus.Prospect,
        Guid? customerRef = null,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Account name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(owner))
            throw new ArgumentException("Owner is required.", nameof(owner));
        if (annualRevenue < 0)
            throw new ArgumentException("Annual revenue cannot be negative.", nameof(annualRevenue));

        return new Account
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Industry = industry?.Trim(),
            Website = website?.Trim(),
            Phone = phone?.Trim(),
            Size = size?.Trim(),
            AnnualRevenue = annualRevenue,
            Owner = owner.Trim(),
            Status = status,
            CustomerRef = customerRef,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void UpdateDetails(string name, string? industry, string? website, string? phone, string? size, decimal annualRevenue, string owner, AccountStatus status, string? updatedBy)
    {
        Name = name.Trim();
        Industry = industry?.Trim();
        Website = website?.Trim();
        Phone = phone?.Trim();
        Size = size?.Trim();
        AnnualRevenue = annualRevenue;
        Owner = owner.Trim();
        Status = status;
        Touch(updatedBy);
    }

    public void LinkCustomer(Guid customerRef, string? updatedBy)
    {
        CustomerRef = customerRef;
        Touch(updatedBy);
    }

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
