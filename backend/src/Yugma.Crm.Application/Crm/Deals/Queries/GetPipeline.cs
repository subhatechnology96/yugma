using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Queries;

// Stages with their grouped deals — powers both the Kanban board and the funnel chart.
public sealed record GetPipelineQuery : IRequest<Result<PipelineDto>>;

internal sealed class GetPipelineHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IDealStageRepository stages)
    : IRequestHandler<GetPipelineQuery, Result<PipelineDto>>
{
    public async Task<Result<PipelineDto>> Handle(GetPipelineQuery req, CancellationToken ct)
    {
        var allStages = (await stages.ListAsync(ct)).OrderBy(s => s.Order).ToList();
        var allDeals = await deals.AllAsync(ct);
        var accountNames = (await accounts.AllAsync(ct)).ToDictionary(a => a.Id, a => a.Name);

        var byStage = allDeals.ToLookup(d => d.StageId);

        var stageDtos = allStages.Select(s =>
        {
            var stageDeals = byStage[s.Id]
                .Select(d => d.ToDto(accountNames.GetValueOrDefault(d.AccountId, "—"), s.Name))
                .ToList();
            return new PipelineStageDto(
                s.Id, s.Name, s.Order, s.Probability, s.IsWon, s.IsLost,
                stageDeals.Sum(d => d.Value), stageDeals.Count, stageDeals);
        }).ToList();

        var openStages = stageDtos.Where(s => !s.IsWon && !s.IsLost).ToList();
        var totalOpen = openStages.Sum(s => s.TotalValue);
        var weighted = openStages.Sum(s => s.TotalValue * s.Probability / 100m);

        return new PipelineDto(stageDtos, totalOpen, weighted);
    }
}
