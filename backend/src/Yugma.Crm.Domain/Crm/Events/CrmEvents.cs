using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm.Events;

public sealed record LeadCreated(Guid LeadId, Guid TenantId, string Code) : DomainEvent;
public sealed record LeadConverted(Guid LeadId, Guid TenantId, Guid DealId) : DomainEvent;
public sealed record DealCreated(Guid DealId, Guid TenantId, string Code) : DomainEvent;
public sealed record DealStageChanged(Guid DealId, Guid TenantId, Guid StageId) : DomainEvent;
public sealed record DealWon(Guid DealId, Guid TenantId, decimal Value) : DomainEvent;
