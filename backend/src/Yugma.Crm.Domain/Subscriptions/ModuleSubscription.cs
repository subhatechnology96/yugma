using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Subscriptions;

public sealed class ModuleSubscription : Entity<Guid>, IAggregateRoot
{
    public string ModuleKey { get; set; } = default!;
    public string ModuleName { get; set; } = default!;
    public string Description { get; set; } = default!;
    public string Icon { get; set; } = default!;
    public string Plan { get; set; } = default!;
    public string Status { get; set; } = default!;
    public decimal MonthlyPrice { get; set; }
    public string BillingCycle { get; set; } = default!;
    public int Seats { get; set; }
    public int SeatsUsed { get; set; }
    public DateOnly StartedAt { get; set; }
    public DateOnly RenewsAt { get; set; }
    public string[] Features { get; set; } = Array.Empty<string>();

    public static ModuleSubscription Create(
        Guid tenantId,
        string moduleKey, string moduleName, string description, string icon,
        string plan, string status, decimal monthlyPrice, string billingCycle,
        int seats, int seatsUsed, DateOnly startedAt, DateOnly renewsAt, string[] features)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ModuleKey = moduleKey,
            ModuleName = moduleName,
            Description = description,
            Icon = icon,
            Plan = plan,
            Status = status,
            MonthlyPrice = monthlyPrice,
            BillingCycle = billingCycle,
            Seats = seats,
            SeatsUsed = seatsUsed,
            StartedAt = startedAt,
            RenewsAt = renewsAt,
            Features = features,
            CreatedAt = DateTime.UtcNow
        };
}
