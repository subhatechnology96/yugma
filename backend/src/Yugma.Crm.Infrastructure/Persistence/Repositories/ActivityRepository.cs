using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class ActivityRepository(YugmaDbContext db) : IActivityRepository
{
    public Task<Activity?> GetAsync(Guid id, CancellationToken ct) =>
        db.Activities.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<PagedResult<Activity>> ListAsync(PageRequest request, ActivityStatus? status, ActivityType? type, CancellationToken ct)
    {
        IQueryable<Activity> q = db.Activities.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(e => EF.Functions.ILike(e.Subject, $"%{s}%") || EF.Functions.ILike(e.Owner, $"%{s}%"));
        }
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);
        if (type.HasValue) q = q.Where(e => e.Type == type.Value);

        var total = await q.CountAsync(ct);

        q = (request.SortBy, request.SortDir?.ToLowerInvariant()) switch
        {
            ("dueAt", "desc") => q.OrderByDescending(e => e.DueAt),
            ("createdAt", "desc") => q.OrderByDescending(e => e.CreatedAt),
            _ => q.OrderBy(e => e.DueAt)
        };

        var items = await q.Skip(request.Skip).Take(request.Take).ToListAsync(ct);
        return new PagedResult<Activity>(items, total, request.Page, request.PageSize);
    }

    public async Task<IReadOnlyList<Activity>> ListByRelatedAsync(CrmEntityType type, Guid relatedId, CancellationToken ct) =>
        await db.Activities.AsNoTracking()
            .Where(e => e.RelatedToType == type && e.RelatedToId == relatedId)
            .OrderByDescending(e => e.DueAt).ToListAsync(ct);

    public async Task<IReadOnlyList<Activity>> AllAsync(CancellationToken ct) =>
        await db.Activities.AsNoTracking().ToListAsync(ct);

    public async Task AddAsync(Activity activity, CancellationToken ct) => await db.Activities.AddAsync(activity, ct);

    public void Remove(Activity activity) => db.Activities.Remove(activity);
}
