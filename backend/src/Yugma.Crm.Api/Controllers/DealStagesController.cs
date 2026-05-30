using Yugma.Crm.Application.Crm.DealStages;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/crm/deal-stages")]
[Produces("application/json")]
[Authorize(Policy = "CrmView")]
public sealed class DealStagesController(ISender mediator) : CrmControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<DealStageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct)
        => ToActionResult(await mediator.Send(new ListDealStagesQuery(), ct));
}
