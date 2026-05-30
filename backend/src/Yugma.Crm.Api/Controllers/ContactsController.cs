using Yugma.Crm.Application.Crm.Contacts;
using Yugma.Crm.Shared.Paging;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/contacts")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class ContactsController(ISender mediator) : CrmControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ContactDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? accountId = null,
        [FromQuery] string? sortBy = "fullName",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
        => ToActionResult(await mediator.Send(new ListContactsQuery(page, pageSize, search, accountId, sortBy, sortDir), ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ContactDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new GetContactByIdQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(ContactDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateContactCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(ContactDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateContactBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new UpdateContactCommand(id, body.FullName, body.Email, body.Phone, body.Title, body.Owner, body.IsPrimary), ct));

    public sealed record UpdateContactBody(string FullName, string Email, string Phone, string? Title, string Owner, bool IsPrimary);
}
