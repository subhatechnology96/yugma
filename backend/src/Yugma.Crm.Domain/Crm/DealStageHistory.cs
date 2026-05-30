using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm;

// Append-only audit of a deal's movement through the pipeline. Child of the Deal aggregate.
public sealed class DealStageHistory : Entity<Guid>, IAggregateRoot
{
    public Guid DealId { get; private set; }
    public Guid? FromStageId { get; private set; }
    public Guid ToStageId { get; private set; }
    public DateTime ChangedAt { get; private set; }

    private DealStageHistory() { } // EF

    public static DealStageHistory Create(Guid tenantId, Guid dealId, Guid? fromStageId, Guid toStageId, string? changedBy)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DealId = dealId,
            FromStageId = fromStageId,
            ToStageId = toStageId,
            ChangedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = changedBy
        };
}
