using Yugma.Crm.Shared.Paging;

namespace Yugma.Crm.Domain.Crm;

public interface IActivityRepository
{
    Task<Activity?> GetAsync(Guid id, CancellationToken ct);
    Task<PagedResult<Activity>> ListAsync(PageRequest request, ActivityStatus? status, ActivityType? type, CancellationToken ct);
    Task<IReadOnlyList<Activity>> ListByRelatedAsync(CrmEntityType type, Guid relatedId, CancellationToken ct);
    Task<IReadOnlyList<Activity>> AllAsync(CancellationToken ct);
    Task AddAsync(Activity activity, CancellationToken ct);
    void Remove(Activity activity);
}
