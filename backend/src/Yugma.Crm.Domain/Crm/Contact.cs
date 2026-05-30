using Yugma.Crm.Domain.Common;
using Yugma.Crm.Domain.Hr.ValueObjects;

namespace Yugma.Crm.Domain.Crm;

public sealed class Contact : Entity<Guid>, IAggregateRoot
{
    public PersonName Name { get; private set; } = default!;
    public Email Email { get; private set; } = default!;
    public PhoneNumber Phone { get; private set; } = default!;
    public string? Title { get; private set; }
    public Guid AccountId { get; private set; }
    public string Owner { get; private set; } = default!;
    public bool IsPrimary { get; private set; }

    private Contact() { } // EF

    public static Contact Create(
        Guid tenantId,
        PersonName name,
        Email email,
        PhoneNumber phone,
        string? title,
        Guid accountId,
        string owner,
        bool isPrimary = false,
        string? createdBy = null)
    {
        if (accountId == Guid.Empty)
            throw new ArgumentException("Contact must belong to an account.", nameof(accountId));
        if (string.IsNullOrWhiteSpace(owner))
            throw new ArgumentException("Owner is required.", nameof(owner));

        return new Contact
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            Email = email,
            Phone = phone,
            Title = title?.Trim(),
            AccountId = accountId,
            Owner = owner.Trim(),
            IsPrimary = isPrimary,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void UpdateDetails(PersonName name, Email email, PhoneNumber phone, string? title, string owner, bool isPrimary, string? updatedBy)
    {
        Name = name;
        Email = email;
        Phone = phone;
        Title = title?.Trim();
        Owner = owner.Trim();
        IsPrimary = isPrimary;
        Touch(updatedBy);
    }

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
