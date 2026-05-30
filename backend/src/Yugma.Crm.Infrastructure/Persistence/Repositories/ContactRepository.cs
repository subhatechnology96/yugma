using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class ContactRepository(YugmaDbContext db) : IContactRepository
{
    public Task<Contact?> GetAsync(Guid id, CancellationToken ct) =>
        db.Contacts.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<PagedResult<Contact>> ListAsync(PageRequest request, Guid? accountId, CancellationToken ct)
    {
        IQueryable<Contact> q = db.Contacts.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(e =>
                EF.Functions.ILike(e.Name.First + " " + e.Name.Last, $"%{s}%") ||
                EF.Functions.ILike(e.Email.Value, $"%{s}%") ||
                EF.Functions.ILike(e.Title ?? "", $"%{s}%"));
        }
        if (accountId.HasValue) q = q.Where(e => e.AccountId == accountId.Value);

        var total = await q.CountAsync(ct);

        q = (request.SortBy, request.SortDir?.ToLowerInvariant()) switch
        {
            ("fullName", "desc") => q.OrderByDescending(e => e.Name.First).ThenByDescending(e => e.Name.Last),
            ("createdAt", "desc") => q.OrderByDescending(e => e.CreatedAt),
            _ => q.OrderBy(e => e.Name.First).ThenBy(e => e.Name.Last)
        };

        var items = await q.Skip(request.Skip).Take(request.Take).ToListAsync(ct);
        return new PagedResult<Contact>(items, total, request.Page, request.PageSize);
    }

    public async Task<IReadOnlyList<Contact>> ListByAccountAsync(Guid accountId, CancellationToken ct) =>
        await db.Contacts.AsNoTracking().Where(e => e.AccountId == accountId)
            .OrderByDescending(e => e.IsPrimary).ThenBy(e => e.Name.First).ToListAsync(ct);

    public async Task AddAsync(Contact contact, CancellationToken ct) => await db.Contacts.AddAsync(contact, ct);

    public void Remove(Contact contact) => db.Contacts.Remove(contact);
}
