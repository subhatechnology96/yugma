using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class AccountRepository(YugmaDbContext db) : IAccountRepository
{
    public Task<Account?> GetAsync(Guid id, CancellationToken ct) =>
        db.Accounts.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<PagedResult<Account>> ListAsync(PageRequest request, AccountStatus? status, CancellationToken ct)
    {
        IQueryable<Account> q = db.Accounts.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(e =>
                EF.Functions.ILike(e.Name, $"%{s}%") ||
                EF.Functions.ILike(e.Industry ?? "", $"%{s}%") ||
                EF.Functions.ILike(e.Owner, $"%{s}%"));
        }
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);

        var total = await q.CountAsync(ct);

        q = (request.SortBy, request.SortDir?.ToLowerInvariant()) switch
        {
            ("name", "desc") => q.OrderByDescending(e => e.Name),
            ("revenue", "asc") => q.OrderBy(e => e.AnnualRevenue),
            ("revenue", _) => q.OrderByDescending(e => e.AnnualRevenue),
            ("createdAt", "desc") => q.OrderByDescending(e => e.CreatedAt),
            _ => q.OrderBy(e => e.Name)
        };

        var items = await q.Skip(request.Skip).Take(request.Take).ToListAsync(ct);
        return new PagedResult<Account>(items, total, request.Page, request.PageSize);
    }

    public async Task<IReadOnlyList<Account>> AllAsync(CancellationToken ct) =>
        await db.Accounts.AsNoTracking().ToListAsync(ct);

    public async Task AddAsync(Account account, CancellationToken ct) => await db.Accounts.AddAsync(account, ct);

    public void Remove(Account account) => db.Accounts.Remove(account);
}
