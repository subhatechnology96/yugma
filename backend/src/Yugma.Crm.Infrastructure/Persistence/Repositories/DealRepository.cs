using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class DealRepository(YugmaDbContext db) : IDealRepository
{
    public Task<Deal?> GetAsync(Guid id, CancellationToken ct) =>
        db.Deals.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<PagedResult<Deal>> ListAsync(PageRequest request, DealStatus? status, Guid? stageId, string? owner, CancellationToken ct)
    {
        IQueryable<Deal> q = db.Deals.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(e =>
                EF.Functions.ILike(e.Name, $"%{s}%") ||
                EF.Functions.ILike(e.Owner, $"%{s}%") ||
                EF.Functions.ILike(e.Code, $"%{s}%"));
        }
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);
        if (stageId.HasValue) q = q.Where(e => e.StageId == stageId.Value);
        if (!string.IsNullOrWhiteSpace(owner)) q = q.Where(e => e.Owner == owner);

        var total = await q.CountAsync(ct);

        q = (request.SortBy, request.SortDir?.ToLowerInvariant()) switch
        {
            ("value", "asc") => q.OrderBy(e => e.Value),
            ("value", _) => q.OrderByDescending(e => e.Value),
            ("name", "desc") => q.OrderByDescending(e => e.Name),
            ("name", _) => q.OrderBy(e => e.Name),
            ("closeDate", "desc") => q.OrderByDescending(e => e.CloseDate),
            ("createdAt", "desc") => q.OrderByDescending(e => e.CreatedAt),
            _ => q.OrderBy(e => e.CloseDate)
        };

        var items = await q.Skip(request.Skip).Take(request.Take).ToListAsync(ct);
        return new PagedResult<Deal>(items, total, request.Page, request.PageSize);
    }

    public async Task<IReadOnlyList<Deal>> AllAsync(CancellationToken ct) =>
        await db.Deals.AsNoTracking().ToListAsync(ct);

    public async Task<IReadOnlyList<Deal>> ListByAccountAsync(Guid accountId, CancellationToken ct) =>
        await db.Deals.AsNoTracking().Where(e => e.AccountId == accountId)
            .OrderByDescending(e => e.CreatedAt).ToListAsync(ct);

    public async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var count = await db.Deals.IgnoreQueryFilters().CountAsync(ct);
        return $"DEAL-{1000 + count + 1}";
    }

    public async Task AddAsync(Deal deal, CancellationToken ct) => await db.Deals.AddAsync(deal, ct);

    public void Remove(Deal deal) => db.Deals.Remove(deal);
}
