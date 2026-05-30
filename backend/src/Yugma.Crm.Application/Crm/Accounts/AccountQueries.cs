using Yugma.Crm.Application.Crm.Common;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Accounts;

public sealed record ListAccountsQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    string? Status = null,
    string? SortBy = "name",
    string? SortDir = "asc")
    : IRequest<Result<PagedResult<AccountDto>>>;

internal sealed class ListAccountsHandler(IAccountRepository repo)
    : IRequestHandler<ListAccountsQuery, Result<PagedResult<AccountDto>>>
{
    public async Task<Result<PagedResult<AccountDto>>> Handle(ListAccountsQuery req, CancellationToken ct)
    {
        AccountStatus? status = string.IsNullOrWhiteSpace(req.Status) ? null : CrmWire.ParseAccountStatus(req.Status);
        var page = new PageRequest(req.Page, req.PageSize, req.Search, req.SortBy, req.SortDir);
        var result = await repo.ListAsync(page, status, ct);
        var dto = new PagedResult<AccountDto>(
            result.Items.Select(AccountMapping.ToDto).ToList(),
            result.Total, result.Page, result.PageSize);
        return Result.Success(dto);
    }
}

public sealed record GetAccountByIdQuery(Guid Id) : IRequest<Result<AccountDto>>;

internal sealed class GetAccountByIdHandler(IAccountRepository repo)
    : IRequestHandler<GetAccountByIdQuery, Result<AccountDto>>
{
    public async Task<Result<AccountDto>> Handle(GetAccountByIdQuery req, CancellationToken ct)
    {
        var account = await repo.GetAsync(req.Id, ct);
        return account is null
            ? Result.Failure<AccountDto>(Error.NotFound($"Account {req.Id} not found."))
            : account.ToDto();
    }
}
