using System.Security.Claims;
using Yugma.Crm.Domain.Abstractions;
using Microsoft.AspNetCore.Http;

namespace Yugma.Crm.Infrastructure.Auth;

internal sealed class HttpTenantContext(IHttpContextAccessor accessor) : ITenantContext
{
    public Guid TenantId
    {
        get
        {
            var ctx = accessor.HttpContext;
            if (ctx is null) return Guid.Empty;

            // 1) Claim from JWT
            var claim = ctx.User.FindFirstValue("tenant_id");
            if (Guid.TryParse(claim, out var fromClaim)) return fromClaim;

            // 2) X-Tenant-Id header (used by Angular interceptor)
            if (ctx.Request.Headers.TryGetValue("X-Tenant-Id", out var header)
                && Guid.TryParse(header.ToString(), out var fromHeader))
                return fromHeader;

            // 3) Dev default — single-tenant local dev
            return Guid.Parse("00000000-0000-0000-0000-00000000ace1");
        }
    }

    public string? UserId => accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                             ?? accessor.HttpContext?.User?.FindFirstValue("sub");

    public string? UserName => accessor.HttpContext?.User?.Identity?.Name
                               ?? accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Email);
}
