using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.DealStages;

public sealed record DealStageDto(
    Guid Id,
    string Name,
    int Order,
    int Probability,
    bool IsWon,
    bool IsLost);

public sealed record ListDealStagesQuery : IRequest<Result<IReadOnlyList<DealStageDto>>>;

internal sealed class ListDealStagesHandler(IDealStageRepository stages)
    : IRequestHandler<ListDealStagesQuery, Result<IReadOnlyList<DealStageDto>>>
{
    public async Task<Result<IReadOnlyList<DealStageDto>>> Handle(ListDealStagesQuery req, CancellationToken ct)
    {
        var list = (await stages.ListAsync(ct))
            .OrderBy(s => s.Order)
            .Select(s => new DealStageDto(s.Id, s.Name, s.Order, s.Probability, s.IsWon, s.IsLost))
            .ToList();
        return Result.Success<IReadOnlyList<DealStageDto>>(list);
    }
}
