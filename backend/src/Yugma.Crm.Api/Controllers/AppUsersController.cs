using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Audit;
using Yugma.Crm.Domain.Identity;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// User &amp; access management: seat directory, role assignment, MFA enforcement, status lifecycle
/// (invite → active → suspended/inactive) and a role/permission catalog. Every mutation writes an
/// <see cref="AuditLog"/> row. The role catalog is read from the <c>role_definitions</c> table.
/// </summary>
[ApiController]
[Route("api/users")]
[Produces("application/json")]
[Authorize] // any authenticated user may read; writes require the UserManage policy
public sealed class AppUsersController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
    // ---------------- queries ----------------

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q = null, [FromQuery] string? role = null, [FromQuery] string? status = null, CancellationToken ct = default)
    {
        var query = db.AppUsers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => u.Role == role);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<UserStatus>(status, true, out var st))
            query = query.Where(u => u.Status == st);

        var rows = await query.OrderBy(u => u.FullName).ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            rows = rows.Where(u =>
                u.FullName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                u.Email.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (u.JobTitle ?? "").Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (u.Department ?? "").Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return Ok(rows.Select(Dto));
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        var all = await db.AppUsers.AsNoTracking().ToListAsync(ct);
        return Ok(new
        {
            total = all.Count,
            active = all.Count(u => u.Status == UserStatus.Active),
            pending = all.Count(u => u.Status == UserStatus.Pending),
            suspended = all.Count(u => u.Status == UserStatus.Suspended),
            inactive = all.Count(u => u.Status == UserStatus.Inactive),
            mfaEnabled = all.Count(u => u.MfaEnabled),
            mfaCoverage = all.Count == 0 ? 0 : Math.Round(100.0 * all.Count(u => u.MfaEnabled) / all.Count, 0)
        });
    }

    [HttpGet("roles")]
    public async Task<IActionResult> RoleCatalog(CancellationToken ct)
    {
        var roles = await db.RoleDefinitions.AsNoTracking().OrderByDescending(r => r.Rank).ToListAsync(ct);
        var counts = await db.AppUsers.AsNoTracking()
            .GroupBy(u => u.Role)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return Ok(roles.Select(r => new
        {
            key = r.Key,
            label = r.Label,
            description = r.Description,
            tone = r.Tone,
            permissions = r.Permissions,
            members = counts.FirstOrDefault(c => c.Role == r.Key)?.Count ?? 0
        }));
    }

    // ---------------- commands ----------------

    public sealed record InviteBody(string Name, string Email, string Role, string? JobTitle, string? Department, bool Mfa, string? ActedBy);

    [Authorize(Policy = "UserManage")]
    [HttpPost]
    public async Task<IActionResult> Invite([FromBody] InviteBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Email))
            return BadRequest(new { error = "Name and email are required." });
        if (!await IsKnownRoleAsync(body.Role, ct))
            return BadRequest(new { error = $"Unknown role '{body.Role}'." });

        var email = body.Email.Trim().ToLowerInvariant();
        if (await db.AppUsers.AnyAsync(u => u.Email == email, ct))
            return Conflict(new { error = "A user with that email already exists." });

        var user = AppUser.Invite(tenant.TenantId, body.Name.Trim(), email, body.Role, body.JobTitle?.Trim(), body.Department?.Trim(), body.Mfa, Actor(body.ActedBy));
        db.AppUsers.Add(user);
        Audit(user.TenantId, body.ActedBy, "user.invite", $"Invited {user.FullName} <{user.Email}> as {user.Role}");
        await db.SaveChangesAsync(ct);
        return Created($"/api/users/{user.Id}", Dto(user));
    }

    public sealed record UpdateBody(string Name, string Role, string? JobTitle, string? Department, string? ActedBy);

    [Authorize(Policy = "UserManage")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBody body, CancellationToken ct)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (!await IsKnownRoleAsync(body.Role, ct)) return BadRequest(new { error = $"Unknown role '{body.Role}'." });

        var roleChanged = user.Role != body.Role;
        user.UpdateProfile(body.Name.Trim(), body.Role, body.JobTitle?.Trim(), body.Department?.Trim(), Actor(body.ActedBy));
        Audit(user.TenantId, body.ActedBy, roleChanged ? "user.role.change" : "user.update",
            roleChanged ? $"{user.FullName} role → {body.Role}" : $"Updated profile for {user.FullName}");
        await db.SaveChangesAsync(ct);
        return Ok(Dto(user));
    }

    public sealed record StatusBody(string Status, string? ActedBy);

    [Authorize(Policy = "UserManage")]
    [HttpPost("{id:guid}/status")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (!Enum.TryParse<UserStatus>(body.Status, true, out var st))
            return BadRequest(new { error = $"Unknown status '{body.Status}'." });

        user.SetStatus(st, Actor(body.ActedBy));
        Audit(user.TenantId, body.ActedBy, "user.status", $"{user.FullName} status → {st}");
        await db.SaveChangesAsync(ct);
        return Ok(Dto(user));
    }

    public sealed record MfaBody(bool Enabled, string? ActedBy);

    [Authorize(Policy = "UserManage")]
    [HttpPost("{id:guid}/mfa")]
    public async Task<IActionResult> ToggleMfa(Guid id, [FromBody] MfaBody body, CancellationToken ct)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        user.SetMfa(body.Enabled, Actor(body.ActedBy));
        Audit(user.TenantId, body.ActedBy, "user.mfa", $"MFA {(body.Enabled ? "enabled" : "disabled")} for {user.FullName}");
        await db.SaveChangesAsync(ct);
        return Ok(Dto(user));
    }

    [Authorize(Policy = "UserManage")]
    [HttpPost("{id:guid}/resend-invite")]
    public async Task<IActionResult> ResendInvite(Guid id, [FromBody] StatusBody? body, CancellationToken ct)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (user.Status != UserStatus.Pending)
            return BadRequest(new { error = "Only pending invitations can be resent." });

        user.MarkInviteResent(Actor(body?.ActedBy));
        Audit(user.TenantId, body?.ActedBy, "user.invite.resend", $"Re-sent invitation to {user.Email}");
        await db.SaveChangesAsync(ct);
        return Ok(Dto(user));
    }

    [Authorize(Policy = "UserManage")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, [FromQuery] string? actedBy = null, CancellationToken ct = default)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (user.Role == "Owner")
            return BadRequest(new { error = "The workspace owner cannot be removed." });

        db.AppUsers.Remove(user);
        Audit(user.TenantId, actedBy, "user.remove", $"Removed {user.FullName} <{user.Email}>");
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------- helpers ----------------

    private async Task<bool> IsKnownRoleAsync(string? role, CancellationToken ct) =>
        role is not null && await db.RoleDefinitions.AnyAsync(r => r.Key == role, ct);

    private static string Actor(string? actedBy) => string.IsNullOrWhiteSpace(actedBy) ? "system" : actedBy.Trim();

    private void Audit(Guid tenantId, string? actedBy, string action, string resource) =>
        db.AuditLogs.Add(AuditLog.Create(tenantId, DateTime.UtcNow, Actor(actedBy), action, resource,
            HttpContext.Connection.RemoteIpAddress?.ToString(), AuditOutcome.Success));

    private static object Dto(AppUser u) => new
    {
        id = u.Id,
        name = u.FullName,
        email = u.Email,
        role = u.Role,
        jobTitle = u.JobTitle,
        department = u.Department,
        mfa = u.MfaEnabled,
        lastLoginAt = u.LastLoginAt,
        invitedAt = u.InvitedAt,
        createdAt = u.CreatedAt,
        status = u.Status.ToString().ToLowerInvariant()
    };
}
