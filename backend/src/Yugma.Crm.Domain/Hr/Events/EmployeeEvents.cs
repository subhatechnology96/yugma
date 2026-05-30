using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Events;

public sealed record EmployeeCreated(Guid EmployeeId, Guid TenantId, string Code) : DomainEvent;
public sealed record EmployeeStatusChanged(Guid EmployeeId, Guid TenantId, EmployeeStatus Status) : DomainEvent;
