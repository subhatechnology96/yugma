using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Audit;

public enum AuditOutcome { Success, Failed }

public sealed class AuditLog : Entity<Guid>, IAggregateRoot
{
    public DateTime At { get; set; }
    public string Who { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string Resource { get; set; } = default!;
    public string? Ip { get; set; }
    public AuditOutcome Outcome { get; set; }

    public static AuditLog Create(Guid tenantId, DateTime at, string who, string action, string resource, string? ip, AuditOutcome outcome)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            At = at,
            Who = who,
            Action = action,
            Resource = resource,
            Ip = ip,
            Outcome = outcome,
            CreatedAt = DateTime.UtcNow
        };
}
