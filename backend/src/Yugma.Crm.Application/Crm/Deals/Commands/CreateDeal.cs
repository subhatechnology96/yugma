using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Commands;

public sealed record CreateDealCommand(
    string Name,
    Guid AccountId,
    Guid? ContactId,
    decimal Value,
    Guid StageId,
    DateOnly CloseDate,
    string Owner) : IRequest<Result<DealDto>>;

public sealed class CreateDealValidator : AbstractValidator<CreateDealCommand>
{
    public CreateDealValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AccountId).NotEmpty();
        RuleFor(x => x.StageId).NotEmpty();
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Owner).NotEmpty();
    }
}

internal sealed class CreateDealHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IDealStageRepository stages,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<CreateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand req, CancellationToken ct)
    {
        var account = await accounts.GetAsync(req.AccountId, ct);
        if (account is null)
            return Result.Failure<DealDto>(Error.Validation($"Account {req.AccountId} does not exist."));

        var stage = await stages.GetAsync(req.StageId, ct);
        if (stage is null)
            return Result.Failure<DealDto>(Error.Validation($"Stage {req.StageId} does not exist."));

        var code = await deals.NextCodeAsync(ct);
        var deal = Deal.Create(
            tenant.TenantId, code, req.Name, req.AccountId, req.ContactId,
            req.Value, stage.Id, stage.Probability, req.CloseDate,
            req.Owner, tenant.UserName);

        await deals.AddAsync(deal, ct);
        await uow.SaveChangesAsync(ct);

        return deal.ToDto(account.Name, stage.Name);
    }
}
