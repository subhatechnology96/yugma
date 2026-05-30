using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class NotificationsController(YugmaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await db.Notifications.AsNoTracking()
            .OrderByDescending(n => n.CreatedAtUtc)
            .Select(n => new
            {
                id = n.Id,
                title = n.Title,
                message = n.Message,
                kind = n.Kind.ToString().ToLowerInvariant(),
                createdAt = n.CreatedAtUtc,
                read = n.ReadAtUtc != null,
                link = n.Link
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (n is null) return NotFound();
        if (n.ReadAtUtc is null)
        {
            n.ReadAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var unread = await db.Notifications.Where(n => n.ReadAtUtc == null).ToListAsync(ct);
        foreach (var n in unread) n.ReadAtUtc = now;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
