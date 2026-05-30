using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Commands;

public sealed record ChangeDealStatusCommand(Guid Id, string Status) : IRequest<Result<DealDto>>;

internal sealed class ChangeDealStatusHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IDealStageRepository stages,
    IUnitOfWork uow,
    ITenantContext tenant)
    : IRequestHandler<ChangeDealStatusCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(ChangeDealStatusCommand req, CancellationToken ct)
    {
        var deal = await deals.GetAsync(req.Id, ct);
        if (deal is null)
            return Result.Failure<DealDto>(Error.NotFound($"Deal {req.Id} not found."));

        DealStatus status = req.Status?.ToLowerInvariant() switch
        {
            "won" => DealStatus.Won,
            "lost" => DealStatus.Lost,
            "open" => DealStatus.Open,
            _ => DealStatus.Open
        };

        deal.SetStatus(status, tenant.UserName);
        await uow.SaveChangesAsync(ct);

        var account = await accounts.GetAsync(deal.AccountId, ct);
        var stage = await stages.GetAsync(deal.StageId, ct);
        return deal.ToDto(account?.Name ?? "—", stage?.Name ?? "—");
    }
}
