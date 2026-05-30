using Yugma.Crm.Application.Crm.Activities;
using Yugma.Crm.Shared.Paging;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/activities")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class ActivitiesController(ISender mediator) : CrmControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ActivityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] string? sortBy = "dueAt",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
        => ToActionResult(await mediator.Send(new ListActivitiesQuery(page, pageSize, search, status, type, sortBy, sortDir), ct));

    [HttpGet("related")]
    [ProducesResponseType(typeof(IReadOnlyList<ActivityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ByRelated([FromQuery] string type, [FromQuery] Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new ListActivitiesByRelatedQuery(type, id), ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ActivityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new GetActivityByIdQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(ActivityDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateActivityCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPost("{id:guid}/done")]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(ActivityDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkDone(Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new MarkActivityDoneCommand(id), ct));
}
