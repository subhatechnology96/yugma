using Yugma.Crm.Application.Crm.Deals;
using Yugma.Crm.Application.Crm.Deals.Commands;
using Yugma.Crm.Application.Crm.Deals.Queries;
using Yugma.Crm.Shared.Paging;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/deals")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class DealsController(ISender mediator) : CrmControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<DealDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? stageId = null,
        [FromQuery] string? owner = null,
        [FromQuery] string? sortBy = "closeDate",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
        => ToActionResult(await mediator.Send(new ListDealsQuery(page, pageSize, search, status, stageId, owner, sortBy, sortDir), ct));

    [HttpGet("pipeline")]
    [ProducesResponseType(typeof(PipelineDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Pipeline(CancellationToken ct)
        => ToActionResult(await mediator.Send(new GetPipelineQuery(), ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DealDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new GetDealByIdQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(DealDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateDealCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(DealDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDealBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new UpdateDealCommand(id, body.Name, body.Value, body.CloseDate, body.Owner, body.ContactId), ct));

    [HttpPost("{id:guid}/stage")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(DealDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> MoveStage(Guid id, [FromBody] MoveStageBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new MoveDealStageCommand(id, body.StageId), ct));

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(DealDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] StatusBody body, CancellationToken ct)
        => ToActionResult(await mediator.Send(new ChangeDealStatusCommand(id, body.Status), ct));

    public sealed record UpdateDealBody(string Name, decimal Value, DateOnly CloseDate, string Owner, Guid? ContactId);
    public sealed record MoveStageBody(Guid StageId);
    public sealed record StatusBody(string Status);
}
