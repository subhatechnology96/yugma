using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Queries;

public sealed record GetEmployeeByIdQuery(Guid Id) : IRequest<Result<EmployeeDto>>;

internal sealed class GetEmployeeByIdHandler(IEmployeeRepository repo)
    : IRequestHandler<GetEmployeeByIdQuery, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByIdQuery req, CancellationToken ct)
    {
        var emp = await repo.GetAsync(req.Id, ct);
        return emp is null
            ? Result.Failure<EmployeeDto>(Error.NotFound($"Employee {req.Id} not found."))
            : emp.ToDto();
    }
}
