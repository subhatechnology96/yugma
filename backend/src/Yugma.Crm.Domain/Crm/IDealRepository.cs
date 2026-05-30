using Yugma.Crm.Shared.Paging;

namespace Yugma.Crm.Domain.Crm;

public interface IDealRepository
{
    Task<Deal?> GetAsync(Guid id, CancellationToken ct);
    Task<PagedResult<Deal>> ListAsync(PageRequest request, DealStatus? status, Guid? stageId, string? owner, CancellationToken ct);
    Task<IReadOnlyList<Deal>> AllAsync(CancellationToken ct);
    Task<IReadOnlyList<Deal>> ListByAccountAsync(Guid accountId, CancellationToken ct);
    Task<string> NextCodeAsync(CancellationToken ct);
    Task AddAsync(Deal deal, CancellationToken ct);
    void Remove(Deal deal);
}
