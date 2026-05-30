using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Activities;

public sealed record ListActivitiesQuery(
    int Page = 1,
    int PageSize = 50,
    string? Search = null,
    string? Status = null,
    string? Type = null,
    string? SortBy = "dueAt",
    string? SortDir = "asc")
    : IRequest<Result<PagedResult<ActivityDto>>>;

internal sealed class ListActivitiesHandler(IActivityRepository repo)
    : IRequestHandler<ListActivitiesQuery, Result<PagedResult<ActivityDto>>>
{
    public async Task<Result<PagedResult<ActivityDto>>> Handle(ListActivitiesQuery req, CancellationToken ct)
    {
        ActivityStatus? status = req.Status?.ToLowerInvariant() switch
        {
            "open" => ActivityStatus.Open,
            "done" => ActivityStatus.Done,
            _ => null
        };
        ActivityType? type = string.IsNullOrWhiteSpace(req.Type) ? null : CrmWire.ParseActivityType(req.Type);

        var page = new PageRequest(req.Page, req.PageSize, req.Search, req.SortBy, req.SortDir);
        var result = await repo.ListAsync(page, status, type, ct);
        var dto = new PagedResult<ActivityDto>(
            result.Items.Select(ActivityMapping.ToDto).ToList(),
            result.Total, result.Page, result.PageSize);
        return Result.Success(dto);
    }
}

public sealed record GetActivityByIdQuery(Guid Id) : IRequest<Result<ActivityDto>>;

internal sealed class GetActivityByIdHandler(IActivityRepository repo)
    : IRequestHandler<GetActivityByIdQuery, Result<ActivityDto>>
{
    public async Task<Result<ActivityDto>> Handle(GetActivityByIdQuery req, CancellationToken ct)
    {
        var activity = await repo.GetAsync(req.Id, ct);
        return activity is null
            ? Result.Failure<ActivityDto>(Error.NotFound($"Activity {req.Id} not found."))
            : activity.ToDto();
    }
}

public sealed record ListActivitiesByRelatedQuery(string RelatedToType, Guid RelatedToId)
    : IRequest<Result<IReadOnlyList<ActivityDto>>>;

internal sealed class ListActivitiesByRelatedHandler(IActivityRepository repo)
    : IRequestHandler<ListActivitiesByRelatedQuery, Result<IReadOnlyList<ActivityDto>>>
{
    public async Task<Result<IReadOnlyList<ActivityDto>>> Handle(ListActivitiesByRelatedQuery req, CancellationToken ct)
    {
        var type = CrmWire.ParseEntityType(req.RelatedToType);
        var list = (await repo.ListByRelatedAsync(type, req.RelatedToId, ct))
            .Select(ActivityMapping.ToDto).ToList();
        return Result.Success<IReadOnlyList<ActivityDto>>(list);
    }
}
