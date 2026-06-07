using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Commands;

/// <summary>Sets (or clears, when <paramref name="HrPartnerId"/> is null) the HR person responsible for an employee.</summary>
public sealed record AssignHrPartnerCommand(Guid Id, Guid? HrPartnerId) : IRequest<Result<EmployeeDto>>;

internal sealed class AssignHrPartnerHandler(
    IEmployeeRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<AssignHrPartnerCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(AssignHrPartnerCommand req, CancellationToken ct)
    {
        var employee = await repo.GetAsync(req.Id, ct);
        if (employee is null) return Result.Failure<EmployeeDto>(Error.NotFound($"Employee {req.Id} not found."));

        if (req.HrPartnerId is Guid partnerId)
        {
            if (partnerId == req.Id)
                return Result.Failure<EmployeeDto>(Error.Validation("An employee cannot be their own HR partner."));
            var partner = await repo.GetAsync(partnerId, ct);
            if (partner is null) return Result.Failure<EmployeeDto>(Error.NotFound($"HR partner {partnerId} not found."));
            employee.AssignHrPartner(partner.Id, partner.Name.Full, tenant.UserName);
        }
        else
        {
            employee.AssignHrPartner(null, null, tenant.UserName);
        }

        await uow.SaveChangesAsync(ct);
        return employee.ToDto();
    }
}
