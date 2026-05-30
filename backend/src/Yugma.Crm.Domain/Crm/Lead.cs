using Yugma.Crm.Domain.Common;
using Yugma.Crm.Domain.Crm.Events;
using Yugma.Crm.Domain.Hr.ValueObjects;

namespace Yugma.Crm.Domain.Crm;

public sealed class Lead : Entity<Guid>, IAggregateRoot
{
    public string Code { get; private set; } = default!;
    public PersonName Name { get; private set; } = default!;
    public string Company { get; private set; } = default!;
    public Email Email { get; private set; } = default!;
    public PhoneNumber Phone { get; private set; } = default!;
    public LeadSource Source { get; private set; }
    public LeadStatus Status { get; private set; }
    public int Score { get; private set; }
    public string Owner { get; private set; } = default!;

    public Guid? ConvertedAccountId { get; private set; }
    public Guid? ConvertedContactId { get; private set; }
    public Guid? ConvertedDealId { get; private set; }
    public DateTime? ConvertedAt { get; private set; }

    private Lead() { } // EF

    public static Lead Create(
        Guid tenantId,
        string code,
        PersonName name,
        string company,
        Email email,
        PhoneNumber phone,
        LeadSource source,
        int score,
        string owner,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Lead code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(company))
            throw new ArgumentException("Company is required.", nameof(company));
        if (string.IsNullOrWhiteSpace(owner))
            throw new ArgumentException("Owner is required.", nameof(owner));

        var lead = new Lead
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim(),
            Name = name,
            Company = company.Trim(),
            Email = email,
            Phone = phone,
            Source = source,
            Status = LeadStatus.New,
            Score = Clamp(score),
            Owner = owner.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        lead.Raise(new LeadCreated(lead.Id, lead.TenantId, lead.Code));
        return lead;
    }

    public void UpdateDetails(PersonName name, string company, Email email, PhoneNumber phone, LeadSource source, string owner, string? updatedBy)
    {
        Name = name;
        Company = company.Trim();
        Email = email;
        Phone = phone;
        Source = source;
        Owner = owner.Trim();
        Touch(updatedBy);
    }

    public void SetStatus(LeadStatus status, string? updatedBy)
    {
        if (Status == status) return;
        if (Status == LeadStatus.Converted)
            throw new InvalidOperationException("A converted lead cannot change status.");
        Status = status;
        Touch(updatedBy);
    }

    public void Rescore(int score, string? updatedBy)
    {
        Score = Clamp(score);
        Touch(updatedBy);
    }

    public void MarkConverted(Guid accountId, Guid? contactId, Guid dealId, string? updatedBy)
    {
        Status = LeadStatus.Converted;
        ConvertedAccountId = accountId;
        ConvertedContactId = contactId;
        ConvertedDealId = dealId;
        ConvertedAt = DateTime.UtcNow;
        Touch(updatedBy);
        Raise(new LeadConverted(Id, TenantId, dealId));
    }

    private static int Clamp(int score) => Math.Clamp(score, 0, 100);

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
