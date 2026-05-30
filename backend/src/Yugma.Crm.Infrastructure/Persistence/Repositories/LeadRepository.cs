using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class LeadRepository(YugmaDbContext db) : ILeadRepository
{
    public Task<Lead?> GetAsync(Guid id, CancellationToken ct) =>
        db.Leads.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<PagedResult<Lead>> ListAsync(PageRequest request, LeadStatus? status, LeadSource? source, CancellationToken ct)
    {
        IQueryable<Lead> q = db.Leads.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(e =>
                EF.Functions.ILike(e.Name.First + " " + e.Name.Last, $"%{s}%") ||
                EF.Functions.ILike(e.Company, $"%{s}%") ||
                EF.Functions.ILike(e.Email.Value, $"%{s}%") ||
                EF.Functions.ILike(e.Owner, $"%{s}%") ||
                EF.Functions.ILike(e.Code, $"%{s}%"));
        }
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);
        if (source.HasValue) q = q.Where(e => e.Source == source.Value);

        var total = await q.CountAsync(ct);

        q = (request.SortBy, request.SortDir?.ToLowerInvariant()) switch
        {
            ("score", "asc") => q.OrderBy(e => e.Score),
            ("score", _) => q.OrderByDescending(e => e.Score),
            ("fullName", "desc") => q.OrderByDescending(e => e.Name.First).ThenByDescending(e => e.Name.Last),
            ("fullName", _) => q.OrderBy(e => e.Name.First).ThenBy(e => e.Name.Last),
            ("company", "desc") => q.OrderByDescending(e => e.Company),
            ("company", _) => q.OrderBy(e => e.Company),
            ("createdAt", "asc") => q.OrderBy(e => e.CreatedAt),
            _ => q.OrderByDescending(e => e.CreatedAt)
        };

        var items = await q.Skip(request.Skip).Take(request.Take).ToListAsync(ct);
        return new PagedResult<Lead>(items, total, request.Page, request.PageSize);
    }

    public async Task<IReadOnlyList<Lead>> AllAsync(CancellationToken ct) =>
        await db.Leads.AsNoTracking().ToListAsync(ct);

    public async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var count = await db.Leads.IgnoreQueryFilters().CountAsync(ct);
        return $"LEAD-{1000 + count + 1}";
    }

    public async Task AddAsync(Lead lead, CancellationToken ct) => await db.Leads.AddAsync(lead, ct);

    public void Remove(Lead lead) => db.Leads.Remove(lead);
}
