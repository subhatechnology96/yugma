using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Accounts;

public sealed record CreateAccountCommand(
    string Name,
    string? Industry,
    string? Website,
    string? Phone,
    string? Size,
    decimal AnnualRevenue,
    string Owner,
    string? Status) : IRequest<Result<AccountDto>>;

public sealed class CreateAccountValidator : AbstractValidator<CreateAccountCommand>
{
    public CreateAccountValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Owner).NotEmpty();
        RuleFor(x => x.AnnualRevenue).GreaterThanOrEqualTo(0);
    }
}

internal sealed class CreateAccountHandler(IAccountRepository repo, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<CreateAccountCommand, Result<AccountDto>>
{
    public async Task<Result<AccountDto>> Handle(CreateAccountCommand req, CancellationToken ct)
    {
        var account = Account.Create(
            tenant.TenantId, req.Name, req.Industry, req.Website, req.Phone, req.Size,
            req.AnnualRevenue, req.Owner, CrmWire.ParseAccountStatus(req.Status), createdBy: tenant.UserName);
        await repo.AddAsync(account, ct);
        await uow.SaveChangesAsync(ct);
        return account.ToDto();
    }
}

public sealed record UpdateAccountCommand(
    Guid Id,
    string Name,
    string? Industry,
    string? Website,
    string? Phone,
    string? Size,
    decimal AnnualRevenue,
    string Owner,
    string? Status) : IRequest<Result<AccountDto>>;

public sealed class UpdateAccountValidator : AbstractValidator<UpdateAccountCommand>
{
    public UpdateAccountValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Owner).NotEmpty();
        RuleFor(x => x.AnnualRevenue).GreaterThanOrEqualTo(0);
    }
}

internal sealed class UpdateAccountHandler(IAccountRepository repo, IUnitOfWork uow, ITenantContext tenant)
    : IRequestHandler<UpdateAccountCommand, Result<AccountDto>>
{
    public async Task<Result<AccountDto>> Handle(UpdateAccountCommand req, CancellationToken ct)
    {
        var account = await repo.GetAsync(req.Id, ct);
        if (account is null)
            return Result.Failure<AccountDto>(Error.NotFound($"Account {req.Id} not found."));

        account.UpdateDetails(req.Name, req.Industry, req.Website, req.Phone, req.Size,
            req.AnnualRevenue, req.Owner, CrmWire.ParseAccountStatus(req.Status), tenant.UserName);
        await uow.SaveChangesAsync(ct);
        return account.ToDto();
    }
}
