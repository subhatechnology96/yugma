using Yugma.Crm.Application.Crm.Notes;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/notes")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class NotesController(ISender mediator) : CrmControllerBase
{
    [HttpGet("related")]
    [ProducesResponseType(typeof(IReadOnlyList<NoteDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ByRelated([FromQuery] string type, [FromQuery] Guid id, CancellationToken ct)
        => ToActionResult(await mediator.Send(new ListNotesByRelatedQuery(type, id), ct));

    [HttpPost]
    [Authorize(Policy = "CrmEdit")]
    [ProducesResponseType(typeof(NoteDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateNoteCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        return ToActionResult(result);
    }
}
