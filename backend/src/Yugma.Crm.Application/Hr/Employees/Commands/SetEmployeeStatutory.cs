using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Commands;

/// <summary>Sets an employee's statutory IDs (PAN/UAN/PF) and bank details — used on the payslip.</summary>
public sealed record SetEmployeeStatutoryCommand(
    Guid Id, string? Gender, string? Pan, string? Uan, string? PfNumber, string? BankName, string? BankAccount)
    : IRequest<Result<EmployeeDto>>;

internal sealed class SetEmployeeStatutoryHandler(IEmployeeRepository repo, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<SetEmployeeStatutoryCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(SetEmployeeStatutoryCommand req, CancellationToken ct)
    {
        var employee = await repo.GetAsync(req.Id, ct);
        if (employee is null) return Result.Failure<EmployeeDto>(Error.NotFound($"Employee {req.Id} not found."));

        employee.SetStatutory(req.Gender, req.Pan, req.Uan, req.PfNumber, req.BankName, req.BankAccount, tenant.UserName);
        await uow.SaveChangesAsync(ct);
        return employee.ToDto();
    }
}
