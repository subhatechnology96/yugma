using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Queries;

public sealed record ListEmployeesQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    string? Department = null,
    string? Status = null,
    string? SortBy = "fullName",
    string? SortDir = "asc")
    : IRequest<Result<PagedResult<EmployeeDto>>>;

internal sealed class ListEmployeesHandler(IEmployeeRepository repo)
    : IRequestHandler<ListEmployeesQuery, Result<PagedResult<EmployeeDto>>>
{
    public async Task<Result<PagedResult<EmployeeDto>>> Handle(ListEmployeesQuery req, CancellationToken ct)
    {
        EmployeeStatus? status = req.Status switch
        {
            "active" => EmployeeStatus.Active,
            "on-leave" => EmployeeStatus.OnLeave,
            "inactive" => EmployeeStatus.Inactive,
            _ => null
        };

        var page = new PageRequest(req.Page, req.PageSize, req.Search, req.SortBy, req.SortDir);
        var result = await repo.ListAsync(page, req.Department, status, ct);
        var dto = new PagedResult<EmployeeDto>(
            result.Items.Select(EmployeeMapping.ToDto).ToList(),
            result.Total,
            result.Page,
            result.PageSize);
        return Result.Success(dto);
    }
}
