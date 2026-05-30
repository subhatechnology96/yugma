namespace Yugma.Crm.Domain.Abstractions;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct);
}

public interface ITenantContext
{
    Guid TenantId { get; }
    string? UserId { get; }
    string? UserName { get; }
}

public interface IClock
{
    DateTime UtcNow { get; }
}
