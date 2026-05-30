using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm;

public sealed class Activity : Entity<Guid>, IAggregateRoot
{
    public ActivityType Type { get; private set; }
    public string Subject { get; private set; } = default!;
    public DateTime DueAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public ActivityStatus Status { get; private set; }
    public CrmEntityType RelatedToType { get; private set; }
    public Guid RelatedToId { get; private set; }
    public string Owner { get; private set; } = default!;
    public DateTime? ReminderAt { get; private set; }

    private Activity() { } // EF

    public static Activity Create(
        Guid tenantId,
        ActivityType type,
        string subject,
        DateTime dueAt,
        CrmEntityType relatedToType,
        Guid relatedToId,
        string owner,
        DateTime? reminderAt = null,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(subject))
            throw new ArgumentException("Subject is required.", nameof(subject));
        if (string.IsNullOrWhiteSpace(owner))
            throw new ArgumentException("Owner is required.", nameof(owner));

        return new Activity
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = type,
            Subject = subject.Trim(),
            DueAt = dueAt,
            Status = ActivityStatus.Open,
            RelatedToType = relatedToType,
            RelatedToId = relatedToId,
            Owner = owner.Trim(),
            ReminderAt = reminderAt,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Reschedule(DateTime dueAt, DateTime? reminderAt, string? updatedBy)
    {
        DueAt = dueAt;
        ReminderAt = reminderAt;
        Touch(updatedBy);
    }

    public void MarkDone(string? updatedBy)
    {
        if (Status == ActivityStatus.Done) return;
        Status = ActivityStatus.Done;
        CompletedAt = DateTime.UtcNow;
        Touch(updatedBy);
    }

    public void Reopen(string? updatedBy)
    {
        Status = ActivityStatus.Open;
        CompletedAt = null;
        Touch(updatedBy);
    }

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
