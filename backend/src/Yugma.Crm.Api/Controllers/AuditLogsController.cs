using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/audit")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class AuditLogsController(YugmaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 100, CancellationToken ct = default)
    {
        var rows = await db.AuditLogs.AsNoTracking()
            .OrderByDescending(l => l.At)
            .Take(Math.Clamp(take, 1, 500))
            .Select(l => new
            {
                at = l.At,
                who = l.Who,
                action = l.Action,
                resource = l.Resource,
                ip = l.Ip ?? "—",
                outcome = l.Outcome.ToString().ToLowerInvariant()
            })
            .ToListAsync(ct);
        return Ok(rows);
    }
}
