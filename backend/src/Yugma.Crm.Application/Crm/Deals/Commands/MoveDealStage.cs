using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using FluentValidation;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Commands;

// Drives Kanban drag-and-drop: move a deal into a target stage and append stage history.
public sealed record MoveDealStageCommand(Guid Id, Guid StageId) : IRequest<Result<DealDto>>;

public sealed class MoveDealStageValidator : AbstractValidator<MoveDealStageCommand>
{
    public MoveDealStageValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.StageId).NotEmpty();
    }
}

internal sealed class MoveDealStageHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IDealStageRepository stages,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<MoveDealStageCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(MoveDealStageCommand req, CancellationToken ct)
    {
        var deal = await deals.GetAsync(req.Id, ct);
        if (deal is null)
            return Result.Failure<DealDto>(Error.NotFound($"Deal {req.Id} not found."));

        var stage = await stages.GetAsync(req.StageId, ct);
        if (stage is null)
            return Result.Failure<DealDto>(Error.Validation($"Stage {req.StageId} does not exist."));

        deal.MoveToStage(stage.Id, stage.Probability, stage.IsWon, stage.IsLost, tenant.UserName);
        await uow.SaveChangesAsync(ct);

        var account = await accounts.GetAsync(deal.AccountId, ct);
        return deal.ToDto(account?.Name ?? "—", stage.Name);
    }
}
