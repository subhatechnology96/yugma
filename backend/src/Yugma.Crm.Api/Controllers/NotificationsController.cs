using System.Security.Claims;
using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Notifications;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Per-user notification inbox. Each user sees only notifications addressed to them:
/// a personal one (<see cref="AppNotification.RecipientEmail"/> matches) or a role-targeted
/// broadcast whose <see cref="AppNotification.Audience"/> they belong to. Marking read is
/// likewise limited to notifications the caller can see.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Produces("application/json")]
[Authorize]
public sealed class NotificationsController(YugmaDbContext db, HrAccess access) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var viewer = await ResolveViewerAsync(ct);
        var all = await db.Notifications.AsNoTracking()
            .OrderByDescending(n => n.CreatedAtUtc)
            .ToListAsync(ct);
        var rows = all
            .Where(n => viewer.CanSee(n))
            .Select(n => new
            {
                id = n.Id,
                title = n.Title,
                message = n.Message,
                kind = n.Kind.ToString().ToLowerInvariant(),
                createdAt = n.CreatedAtUtc,
                read = n.ReadAtUtc != null,
                link = n.Link
            });
        return Ok(rows);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id, ct);
        var viewer = await ResolveViewerAsync(ct);
        // Treat not-visible as not-found so a user can't probe others' notifications by id.
        if (n is null || !viewer.CanSee(n)) return NotFound();
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
        var viewer = await ResolveViewerAsync(ct);
        var now = DateTime.UtcNow;
        var unread = await db.Notifications.Where(n => n.ReadAtUtc == null).ToListAsync(ct);
        var changed = false;
        foreach (var n in unread.Where(viewer.CanSee))
        {
            n.ReadAtUtc = now;
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<Viewer> ResolveViewerAsync(CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        var roles = User.FindAll(ClaimTypes.Role).Select(r => r.Value.ToLowerInvariant()).ToHashSet();
        var isAdmin = roles.Overlaps(new[] { "admin", "owner", "super_admin" });
        return new Viewer(acc.Email, acc.CanManage, isAdmin);
    }

    private sealed record Viewer(string? Email, bool CanManage, bool IsAdmin)
    {
        public bool CanSee(AppNotification n)
        {
            if (!string.IsNullOrWhiteSpace(n.RecipientEmail))
                return string.Equals(n.RecipientEmail, Email, StringComparison.OrdinalIgnoreCase);
            return n.Audience switch
            {
                null or "" or "all" => true,
                "admin" => IsAdmin,
                "hrManage" => CanManage,
                _ => false
            };
        }
    }
}
