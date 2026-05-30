using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Deals.Queries;

public sealed record ListDealsQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    string? Status = null,
    Guid? StageId = null,
    string? Owner = null,
    string? SortBy = "closeDate",
    string? SortDir = "asc")
    : IRequest<Result<PagedResult<DealDto>>>;

internal sealed class ListDealsHandler(
    IDealRepository deals,
    IAccountRepository accounts,
    IDealStageRepository stages)
    : IRequestHandler<ListDealsQuery, Result<PagedResult<DealDto>>>
{
    public async Task<Result<PagedResult<DealDto>>> Handle(ListDealsQuery req, CancellationToken ct)
    {
        DealStatus? status = req.Status switch
        {
            "open" => DealStatus.Open,
            "won" => DealStatus.Won,
            "lost" => DealStatus.Lost,
            _ => null
        };

        var page = new PageRequest(req.Page, req.PageSize, req.Search, req.SortBy, req.SortDir);
        var result = await deals.ListAsync(page, status, req.StageId, req.Owner, ct);

        var accountNames = (await accounts.AllAsync(ct)).ToDictionary(a => a.Id, a => a.Name);
        var stageNames = (await stages.ListAsync(ct)).ToDictionary(s => s.Id, s => s.Name);

        var items = result.Items
            .Select(d => d.ToDto(
                accountNames.GetValueOrDefault(d.AccountId, "—"),
                stageNames.GetValueOrDefault(d.StageId, "—")))
            .ToList();

        return Result.Success(new PagedResult<DealDto>(items, result.Total, result.Page, result.PageSize));
    }
}
