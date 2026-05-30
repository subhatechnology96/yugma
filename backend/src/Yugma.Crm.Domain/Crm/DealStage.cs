using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm;

// Per-tenant pipeline stage lookup. Seeded with: Lead → Qualified → Proposal → Negotiation → Won / Lost.
// Modeled as an entity (not an enum) so the funnel chart and Kanban columns are data-driven.
public sealed class DealStage : Entity<Guid>, IAggregateRoot
{
    public string Name { get; private set; } = default!;
    public int Order { get; private set; }
    public int Probability { get; private set; }
    public bool IsWon { get; private set; }
    public bool IsLost { get; private set; }

    private DealStage() { } // EF

    public static DealStage Create(
        Guid tenantId,
        string name,
        int order,
        int probability,
        bool isWon = false,
        bool isLost = false,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Stage name is required.", nameof(name));

        return new DealStage
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Order = order,
            Probability = Math.Clamp(probability, 0, 100),
            IsWon = isWon,
            IsLost = isLost,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }
}
