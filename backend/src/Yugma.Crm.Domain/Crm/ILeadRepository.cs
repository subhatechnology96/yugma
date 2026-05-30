using Yugma.Crm.Shared.Paging;

namespace Yugma.Crm.Domain.Crm;

public interface ILeadRepository
{
    Task<Lead?> GetAsync(Guid id, CancellationToken ct);
    Task<PagedResult<Lead>> ListAsync(PageRequest request, LeadStatus? status, LeadSource? source, CancellationToken ct);
    Task<IReadOnlyList<Lead>> AllAsync(CancellationToken ct);
    Task<string> NextCodeAsync(CancellationToken ct);
    Task AddAsync(Lead lead, CancellationToken ct);
    void Remove(Lead lead);
}
