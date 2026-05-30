using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Commands;

public sealed record ChangeEmployeeStatusCommand(Guid Id, string Status) : IRequest<Result<EmployeeDto>>;

public sealed class ChangeEmployeeStatusValidator : AbstractValidator<ChangeEmployeeStatusCommand>
{
    public ChangeEmployeeStatusValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Status).Must(s => s is "active" or "on-leave" or "inactive")
            .WithMessage("Status must be active, on-leave or inactive.");
    }
}

internal sealed class ChangeEmployeeStatusHandler(
    IEmployeeRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<ChangeEmployeeStatusCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(ChangeEmployeeStatusCommand req, CancellationToken ct)
    {
        var emp = await repo.GetAsync(req.Id, ct);
        if (emp is null) return Result.Failure<EmployeeDto>(Error.NotFound($"Employee {req.Id} not found."));

        var status = req.Status switch
        {
            "active" => EmployeeStatus.Active,
            "on-leave" => EmployeeStatus.OnLeave,
            _ => EmployeeStatus.Inactive
        };
        emp.SetStatus(status, tenant.UserName);

        await uow.SaveChangesAsync(ct);
        return emp.ToDto();
    }
}
