using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Yugma.Crm.Infrastructure.Auth;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "yugma-crm";
    public string Audience { get; set; } = "yugma-clients";
    public string Secret { get; set; } = "change-me-in-secrets-store-use-at-least-32-chars";
    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 14;
}

public interface IJwtTokenService
{
    (string Token, DateTime ExpiresAt) IssueAccessToken(string userId, string email, string fullName, Guid tenantId, IEnumerable<string> roles, IEnumerable<string> permissions);
    string IssueRefreshToken();
}

public sealed class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _opts = options.Value;

    public (string Token, DateTime ExpiresAt) IssueAccessToken(
        string userId,
        string email,
        string fullName,
        Guid tenantId,
        IEnumerable<string> roles,
        IEnumerable<string> permissions)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opts.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Name, fullName),
            new("tenant_id", tenantId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim("permission", p)));

        var expires = DateTime.UtcNow.AddMinutes(_opts.AccessTokenMinutes);
        var token = new JwtSecurityToken(_opts.Issuer, _opts.Audience, claims, expires: expires, signingCredentials: creds);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public string IssueRefreshToken() => Convert.ToBase64String(Guid.NewGuid().ToByteArray()) + Guid.NewGuid().ToString("N");
}
