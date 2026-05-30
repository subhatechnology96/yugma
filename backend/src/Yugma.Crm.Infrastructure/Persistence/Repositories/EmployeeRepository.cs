using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Shared.Paging;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Infrastructure.Persistence.Repositories;

internal sealed class EmployeeRepository(YugmaDbContext db) : IEmployeeRepository
{
    public Task<Employee?> GetAsync(Guid id, CancellationToken ct) =>
        db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return db.Employees.AnyAsync(e => e.Email.Value == normalized, ct);
    }

    public async Task<PagedResult<Employee>> ListAsync(
        PageRequest request,
        string? department,
        EmployeeStatus? status,
        CancellationToken ct)
    {
        IQueryable<Employee> q = db.Employees.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim();
            q = q.Where(e =>
                EF.Functions.ILike(e.Name.First + " " + e.Name.Last, $"%{s}%") ||
                EF.Functions.ILike(e.Email.Value, $"%{s}%") ||
                EF.Functions.ILike(e.Code, $"%{s}%") ||
                EF.Functions.ILike(e.Department, $"%{s}%") ||
                EF.Functions.ILike(e.Designation, $"%{s}%"));
        }
        if (!string.IsNullOrWhiteSpace(department)) q = q.Where(e => e.Department == department);
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);

        var total = await q.CountAsync(ct);

        q = (request.SortBy, request.SortDir?.ToLowerInvariant()) switch
        {
            ("fullName", "desc") => q.OrderByDescending(e => e.Name.First).ThenByDescending(e => e.Name.Last),
            ("code", "desc") => q.OrderByDescending(e => e.Code),
            ("code", _) => q.OrderBy(e => e.Code),
            ("joinedAt", "desc") => q.OrderByDescending(e => e.JoinedAt),
            ("joinedAt", _) => q.OrderBy(e => e.JoinedAt),
            ("ctcLakhs", "asc") => q.OrderBy(e => e.CtcLakhs),
            ("ctcLakhs", _) => q.OrderByDescending(e => e.CtcLakhs),
            _ => q.OrderBy(e => e.Name.First).ThenBy(e => e.Name.Last)
        };

        var items = await q.Skip(request.Skip).Take(request.Take).ToListAsync(ct);
        return new PagedResult<Employee>(items, total, request.Page, request.PageSize);
    }

    public async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var count = await db.Employees.IgnoreQueryFilters().CountAsync(ct);
        return $"YUG-{1000 + count + 1}";
    }

    public async Task AddAsync(Employee employee, CancellationToken ct)
    {
        await db.Employees.AddAsync(employee, ct);
    }

    public void Remove(Employee employee) => db.Employees.Remove(employee);
}
