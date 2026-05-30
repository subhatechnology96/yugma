using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Queries;

public sealed record GetDealByIdQuery(Guid Id) : IRequest<Result<DealDto>>;

internal sealed class GetDealByIdHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IContactRepository contacts,
    IDealStageRepository stages)
    : IRequestHandler<GetDealByIdQuery, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(GetDealByIdQuery req, CancellationToken ct)
    {
        var deal = await deals.GetAsync(req.Id, ct);
        if (deal is null)
            return Result.Failure<DealDto>(Error.NotFound($"Deal {req.Id} not found."));

        var account = await accounts.GetAsync(deal.AccountId, ct);
        var stage = await stages.GetAsync(deal.StageId, ct);
        string? contactName = null;
        if (deal.ContactId is { } cid)
        {
            var contact = await contacts.GetAsync(cid, ct);
            contactName = contact?.Name.Full;
        }

        return deal.ToDto(account?.Name ?? "—", stage?.Name ?? "—", contactName);
    }
}
