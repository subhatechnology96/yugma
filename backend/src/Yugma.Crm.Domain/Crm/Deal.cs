using Yugma.Crm.Domain.Common;
using Yugma.Crm.Domain.Crm.Events;

namespace Yugma.Crm.Domain.Crm;

public sealed class Deal : Entity<Guid>, IAggregateRoot
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public Guid AccountId { get; private set; }
    public Guid? ContactId { get; private set; }
    public decimal Value { get; private set; }
    public Guid StageId { get; private set; }
    public DealStatus Status { get; private set; }
    public int Probability { get; private set; }
    public DateOnly CloseDate { get; private set; }
    public string Owner { get; private set; } = default!;
    public DateTime? LastActivityAt { get; private set; }

    private readonly List<DealStageHistory> _stageHistory = new();
    public IReadOnlyList<DealStageHistory> StageHistory => _stageHistory.AsReadOnly();

    private Deal() { } // EF

    public static Deal Create(
        Guid tenantId,
        string code,
        string name,
        Guid accountId,
        Guid? contactId,
        decimal value,
        Guid stageId,
        int probability,
        DateOnly closeDate,
        string owner,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Deal code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Deal name is required.", nameof(name));
        if (accountId == Guid.Empty)
            throw new ArgumentException("Deal must belong to an account.", nameof(accountId));
        if (stageId == Guid.Empty)
            throw new ArgumentException("Deal must have a stage.", nameof(stageId));
        if (value < 0)
            throw new ArgumentException("Deal value cannot be negative.", nameof(value));
        if (string.IsNullOrWhiteSpace(owner))
            throw new ArgumentException("Owner is required.", nameof(owner));

        var deal = new Deal
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim(),
            Name = name.Trim(),
            AccountId = accountId,
            ContactId = contactId,
            Value = value,
            StageId = stageId,
            Status = DealStatus.Open,
            Probability = Math.Clamp(probability, 0, 100),
            CloseDate = closeDate,
            Owner = owner.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        deal._stageHistory.Add(DealStageHistory.Create(tenantId, deal.Id, null, stageId, createdBy));
        deal.Raise(new DealCreated(deal.Id, deal.TenantId, deal.Code));
        return deal;
    }

    public void UpdateDetails(string name, decimal value, DateOnly closeDate, string owner, Guid? contactId, string? updatedBy)
    {
        Name = name.Trim();
        Value = value < 0 ? Value : value;
        CloseDate = closeDate;
        Owner = owner.Trim();
        ContactId = contactId;
        Touch(updatedBy);
    }

    public void MoveToStage(Guid stageId, int probability, bool isWon, bool isLost, string? changedBy)
    {
        if (StageId == stageId) return;
        var from = StageId;
        StageId = stageId;
        Probability = Math.Clamp(probability, 0, 100);
        Status = isWon ? DealStatus.Won : isLost ? DealStatus.Lost : DealStatus.Open;
        _stageHistory.Add(DealStageHistory.Create(TenantId, Id, from, stageId, changedBy));
        Touch(changedBy);
        Raise(new DealStageChanged(Id, TenantId, stageId));
        if (isWon) Raise(new DealWon(Id, TenantId, Value));
    }

    public void SetStatus(DealStatus status, string? updatedBy)
    {
        if (Status == status) return;
        Status = status;
        if (status == DealStatus.Won) Probability = 100;
        if (status == DealStatus.Lost) Probability = 0;
        Touch(updatedBy);
        if (status == DealStatus.Won) Raise(new DealWon(Id, TenantId, Value));
    }

    public void TouchActivity(DateTime at) => LastActivityAt = at;

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
