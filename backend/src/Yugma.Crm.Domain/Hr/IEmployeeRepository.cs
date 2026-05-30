using Yugma.Crm.Shared.Paging;

namespace Yugma.Crm.Domain.Hr;

public interface IEmployeeRepository
{
    Task<Employee?> GetAsync(Guid id, CancellationToken ct);
    Task<bool> EmailExistsAsync(string email, CancellationToken ct);
    Task<PagedResult<Employee>> ListAsync(PageRequest request, string? department, EmployeeStatus? status, IReadOnlyCollection<Guid>? restrictToIds, CancellationToken ct);
    Task<string> NextCodeAsync(CancellationToken ct);
    Task AddAsync(Employee employee, CancellationToken ct);
    void Remove(Employee employee);
}
