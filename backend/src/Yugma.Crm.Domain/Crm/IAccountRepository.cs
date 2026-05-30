using Yugma.Crm.Shared.Paging;

namespace Yugma.Crm.Domain.Crm;

public interface IAccountRepository
{
    Task<Account?> GetAsync(Guid id, CancellationToken ct);
    Task<PagedResult<Account>> ListAsync(PageRequest request, AccountStatus? status, CancellationToken ct);
    Task<IReadOnlyList<Account>> AllAsync(CancellationToken ct);
    Task AddAsync(Account account, CancellationToken ct);
    void Remove(Account account);
}
