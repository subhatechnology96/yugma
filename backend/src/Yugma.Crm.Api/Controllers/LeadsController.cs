using Yugma.Crm.Application.Crm.Leads;
using Yugma.Crm.Application.Crm.Leads.Commands;
using Yugma.Crm.Application.Crm.Leads.Queries;
using Yugma.Crm.Shared.Paging;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/leads")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class LeadsController(ISender mediator) : CrmControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<LeadDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? source = null,
        [FromQuery] string? sortBy = "score",
        [FromQuery] string? sortDir = "desc",
        CancellationToken ct = default)
        => ToActionResult(await mediator.Send(new ListLeadsQuery(page, pageSize, search, status, source, sortBy, sortDir), ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LeadDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new GetLeadByIdQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(LeadDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateLeadCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(LeadDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLeadBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new UpdateLeadCommand(id, body.FullName, body.Company, body.Email, body.Phone, body.Source, body.Score, body.Owner), ct));

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(LeadDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] StatusBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new ChangeLeadStatusCommand(id, body.Status), ct));

    [HttpPost("{id:guid}/convert")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(ConvertLeadResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertLeadBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new ConvertLeadCommand(id, body.DealName, body.DealValue, body.CloseDate, body.StageId), ct));

    public sealed record UpdateLeadBody(string FullName, string Company, string Email, string Phone, string Source, int Score, string Owner);
    public sealed record StatusBody(string Status);
    public sealed record ConvertLeadBody(string? DealName, decimal DealValue, DateOnly? CloseDate, Guid? StageId);
}
