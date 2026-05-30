using Yugma.Crm.Domain.Identity;
using Yugma.Crm.Infrastructure.Auth;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController(YugmaDbContext db, IJwtTokenService jwt) : ControllerBase
{
    /// <summary>
    /// Authenticates against the persisted <c>app_users</c> table: verifies the PBKDF2 password hash,
    /// rejects non-active accounts, then issues a signed JWT carrying the user's real role + tenant.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "validation", message = "Email and password are required." });

        var email = req.Email.Trim().ToLowerInvariant();
        // Login is pre-tenant, so bypass the tenant query filter and match on the unique email.
        var user = await db.AppUsers.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null || !PasswordHasher.Verify(req.Password, user.PasswordHash))
            return BadRequest(new { error = "invalid_credentials", message = "Incorrect email or password." });

        if (user.Status != UserStatus.Active)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "account_inactive", message = $"This account is {user.Status.ToString().ToLowerInvariant()}. Contact an administrator." });

        var roles = RolesFor(user.Role);
        var permissions = user.Role.Equals("Member", StringComparison.OrdinalIgnoreCase)
            ? new[] { "self.read", "leave.apply", "profile.update" }
            : new[] { "*" };
        var tenantName = await db.Tenants.Where(t => t.Id == user.TenantId).Select(t => t.Name).FirstOrDefaultAsync(ct) ?? "Workspace";

        var (token, exp) = jwt.IssueAccessToken(
            userId: user.Id.ToString(),
            email: user.Email,
            fullName: user.FullName,
            tenantId: user.TenantId,
            roles: roles,
            permissions: permissions);

        user.RecordLogin();
        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            user = new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                roles,
                permissions,
                tenantId = user.TenantId,
                tenantName,
                mfaEnabled = user.MfaEnabled
            },
            tokens = new
            {
                accessToken = token,
                refreshToken = jwt.IssueRefreshToken(),
                expiresAt = exp
            }
        });
    }

    /// <summary>Returns the identity derived from the bearer token — useful for verifying a session.</summary>
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new
        {
            id = User.FindFirst("sub")?.Value,
            email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value,
            fullName = User.Identity?.Name,
            roles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).ToArray()
        });
    }

    /// <summary>
    /// Maps a stored role to the JWT role claims (lower-cased to match the existing CRM policies and the
    /// Angular role checks). Owner inherits "admin" so it has full access everywhere.
    /// </summary>
    private static string[] RolesFor(string role) => role.ToLowerInvariant() switch
    {
        "owner" => new[] { "owner", "admin" },
        "admin" => new[] { "admin" },
        "manager" => new[] { "manager" },
        "member" => new[] { "member" },
        var r => new[] { r }
    };

    public sealed record LoginRequest(string Email, string Password, bool RememberMe);
}
