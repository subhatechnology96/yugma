using Yugma.Crm.Api.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Single source of truth for the front-end: tells the current user what they may do across the HR
/// module (manage everything vs. see only their own data) and which employee record is "theirs".
/// </summary>
[ApiController]
[Route("api/hr/access")]
[Produces("application/json")]
[Authorize]
public sealed class HrAccessController(HrAccess access) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var a = await access.ResolveAsync(ct);
        return Ok(new
        {
            employeeId = a.SelfId,
            name = a.SelfName,
            department = a.Self?.Department,
            isHr = a.IsHr,
            canManage = a.CanManage,
            isTeamLead = a.IsTeamLead,
            scope = a.Scope
        });
    }
}
