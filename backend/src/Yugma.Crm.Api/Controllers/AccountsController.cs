using Yugma.Crm.Application.Crm.Accounts;
using Yugma.Crm.Shared.Paging;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/accounts")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class AccountsController(ISender mediator) : CrmControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<AccountDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = "name",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
        => ToActionResult(await mediator.Send(new ListAccountsQuery(page, pageSize, search, status, sortBy, sortDir), ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new GetAccountByIdQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(AccountDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateAccountCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(AccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAccountBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new UpdateAccountCommand(id, body.Name, body.Industry, body.Website, body.Phone, body.Size, body.AnnualRevenue, body.Owner, body.Status), ct));

    public sealed record UpdateAccountBody(string Name, string? Industry, string? Website, string? Phone, string? Size, decimal AnnualRevenue, string Owner, string? Status);
}
