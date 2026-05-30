using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Hr.ValueObjects;
using Yugma.Crm.Domain.Provisioning;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Hr.Employees.Commands;

public sealed record CreateEmployeeCommand(
    string FullName,
    string Email,
    string Phone,
    string Department,
    string Designation,
    string Location,
    string EmploymentType,
    DateOnly JoinedAt,
    decimal CtcLakhs,
    string? Manager,
    IReadOnlyList<string> Skills,
    string? AvatarUrl = null) : IRequest<Result<EmployeeDto>>;

public sealed class CreateEmployeeValidator : AbstractValidator<CreateEmployeeCommand>
{
    public CreateEmployeeValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty().MinimumLength(7);
        RuleFor(x => x.Department).NotEmpty();
        RuleFor(x => x.Designation).NotEmpty();
        RuleFor(x => x.Location).NotEmpty();
        RuleFor(x => x.EmploymentType)
            .Must(v => Enum.TryParse<EmploymentType>(v, ignoreCase: true, out _))
            .WithMessage("Employment type must be one of: FullTime, PartTime, Contract, Intern.");
        RuleFor(x => x.CtcLakhs).GreaterThanOrEqualTo(0);
        RuleFor(x => x.JoinedAt).LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)));
        // Allow a URL or an inline base64 data URL (~2MB image after encoding); reject anything larger.
        RuleFor(x => x.AvatarUrl)
            .MaximumLength(3_000_000)
            .WithMessage("Photo is too large. Please use an image under ~2 MB.")
            .When(x => !string.IsNullOrEmpty(x.AvatarUrl));
    }
}

internal sealed class CreateEmployeeHandler(
    IEmployeeRepository repo,
    IUnitOfWork uow,
    ITenantContext tenant,
    IEmployeeProvisioningHook provisioning)
    : IRequestHandler<CreateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(CreateEmployeeCommand req, CancellationToken ct)
    {
        if (await repo.EmailExistsAsync(req.Email, ct))
            return Result.Failure<EmployeeDto>(Error.Conflict($"An employee with email '{req.Email}' already exists."));

        var employmentType = Enum.Parse<EmploymentType>(req.EmploymentType, ignoreCase: true);
        var code = await repo.NextCodeAsync(ct);

        var employee = Employee.Create(
            tenant.TenantId,
            code,
            PersonName.Create(req.FullName),
            Email.Create(req.Email),
            PhoneNumber.Create(req.Phone),
            req.Department,
            req.Designation,
            req.Location,
            employmentType,
            req.JoinedAt,
            req.CtcLakhs,
            req.Manager,
            req.Skills,
            tenant.UserName,
            req.AvatarUrl);

        await repo.AddAsync(employee, ct);

        // Open a provisioning ticket + notify the IT/Network team.
        await provisioning.OnEmployeeCreatedAsync(
            employee.Id,
            employee.Name.Full,
            employee.Email.Value,
            employee.Department,
            employee.Designation,
            employee.Location,
            ct);

        await uow.SaveChangesAsync(ct);

        return employee.ToDto();
    }
}
