using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Commands;

public sealed record UpdateDealCommand(
    Guid Id,
    string Name,
    decimal Value,
    DateOnly CloseDate,
    string Owner,
    Guid? ContactId) : IRequest<Result<DealDto>>;

public sealed class UpdateDealValidator : AbstractValidator<UpdateDealCommand>
{
    public UpdateDealValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Owner).NotEmpty();
    }
}

internal sealed class UpdateDealHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IDealStageRepository stages,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<UpdateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(UpdateDealCommand req, CancellationToken ct)
    {
        var deal = await deals.GetAsync(req.Id, ct);
        if (deal is null)
            return Result.Failure<DealDto>(Error.NotFound($"Deal {req.Id} not found."));

        deal.UpdateDetails(req.Name, req.Value, req.CloseDate, req.Owner, req.ContactId, tenant.UserName);
        await uow.SaveChangesAsync(ct);

        var account = await accounts.GetAsync(deal.AccountId, ct);
        var stage = await stages.GetAsync(deal.StageId, ct);
        return deal.ToDto(account?.Name ?? "—", stage?.Name ?? "—");
    }
}
