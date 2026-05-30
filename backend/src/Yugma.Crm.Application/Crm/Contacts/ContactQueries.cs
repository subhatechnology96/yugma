using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;

namespace Yugma.Crm.Application.Crm.Contacts;

public sealed record ListContactsQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    Guid? AccountId = null,
    string? SortBy = "fullName",
    string? SortDir = "asc")
    : IRequest<Result<PagedResult<ContactDto>>>;

internal sealed class ListContactsHandler(IContactRepository repo, IAccountRepository accounts)
    : IRequestHandler<ListContactsQuery, Result<PagedResult<ContactDto>>>
{
    public async Task<Result<PagedResult<ContactDto>>> Handle(ListContactsQuery req, CancellationToken ct)
    {
        var page = new PageRequest(req.Page, req.PageSize, req.Search, req.SortBy, req.SortDir);
        var result = await repo.ListAsync(page, req.AccountId, ct);
        var accountNames = (await accounts.AllAsync(ct)).ToDictionary(a => a.Id, a => a.Name);
        var dto = new PagedResult<ContactDto>(
            result.Items.Select(c => c.ToDto(accountNames.GetValueOrDefault(c.AccountId, "—"))).ToList(),
            result.Total, result.Page, result.PageSize);
        return Result.Success(dto);
    }
}

public sealed record GetContactByIdQuery(Guid Id) : IRequest<Result<ContactDto>>;

internal sealed class GetContactByIdHandler(IContactRepository repo, IAccountRepository accounts)
    : IRequestHandler<GetContactByIdQuery, Result<ContactDto>>
{
    public async Task<Result<ContactDto>> Handle(GetContactByIdQuery req, CancellationToken ct)
    {
        var contact = await repo.GetAsync(req.Id, ct);
        if (contact is null)
            return Result.Failure<ContactDto>(Error.NotFound($"Contact {req.Id} not found."));
        var account = await accounts.GetAsync(contact.AccountId, ct);
        return contact.ToDto(account?.Name ?? "—");
    }
}
