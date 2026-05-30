using Yugma.Crm.Shared.Paging;

namespace Yugma.Crm.Domain.Crm;

public interface IContactRepository
{
    Task<Contact?> GetAsync(Guid id, CancellationToken ct);
    Task<PagedResult<Contact>> ListAsync(PageRequest request, Guid? accountId, CancellationToken ct);
    Task<IReadOnlyList<Contact>> ListByAccountAsync(Guid accountId, CancellationToken ct);
    Task AddAsync(Contact contact, CancellationToken ct);
    void Remove(Contact contact);
}
