using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Commands;

public sealed record UpdateEmployeeCommand(
    Guid Id,
    string Email,
    string Phone,
    string Department,
    string Designation,
    string Location,
    string? Manager,
    IReadOnlyList<string> Skills) : IRequest<Result<EmployeeDto>>;

public sealed class UpdateEmployeeValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.Department).NotEmpty();
        RuleFor(x => x.Designation).NotEmpty();
    }
}

internal sealed class UpdateEmployeeHandler(
    IEmployeeRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<UpdateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(UpdateEmployeeCommand req, CancellationToken ct)
    {
        var employee = await repo.GetAsync(req.Id, ct);
        if (employee is null) return Result.Failure<EmployeeDto>(Error.NotFound($"Employee {req.Id} not found."));

        employee.UpdateContact(Email.Create(req.Email), PhoneNumber.Create(req.Phone), req.Location, tenant.UserName);
        employee.Reassign(req.Department, req.Designation, req.Manager, tenant.UserName);
        employee.ReplaceSkills(req.Skills);

        await uow.SaveChangesAsync(ct);
        return employee.ToDto();
    }
}
