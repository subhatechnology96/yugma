using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Leads.Queries;

public sealed record ListLeadsQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    string? Status = null,
    string? Source = null,
    string? SortBy = "score",
    string? SortDir = "desc")
    : IRequest<Result<PagedResult<LeadDto>>>;

internal sealed class ListLeadsHandler(ILeadRepository repo)
    : IRequestHandler<ListLeadsQuery, Result<PagedResult<LeadDto>>>
{
    public async Task<Result<PagedResult<LeadDto>>> Handle(ListLeadsQuery req, CancellationToken ct)
    {
        LeadStatus? status = string.IsNullOrWhiteSpace(req.Status) ? null : LeadMapping.ParseStatus(req.Status);
        LeadSource? source = string.IsNullOrWhiteSpace(req.Source) ? null : LeadMapping.ParseSource(req.Source);

        var page = new PageRequest(req.Page, req.PageSize, req.Search, req.SortBy, req.SortDir);
        var result = await repo.ListAsync(page, status, source, ct);

        var dto = new PagedResult<LeadDto>(
            result.Items.Select(LeadMapping.ToDto).ToList(),
            result.Total, result.Page, result.PageSize);
        return Result.Success(dto);
    }
}
