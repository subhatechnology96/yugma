using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr.Referrals;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/referrals")]
[Produces("application/json")]
[Authorize] // HR / admins only — gated by the action filter below
public sealed class ReferralsController(YugmaDbContext db, ITenantContext tenant, HrAccess access) : ControllerBase, IAsyncActionFilter
{
    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if ((await access.ResolveAsync(context.HttpContext.RequestAborted)).Restricted)
        {
            context.Result = new ObjectResult(new { message = "Referrals are available to HR and administrators only." }) { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }
        await next();
    }

    private string Actor() => (access.ResolveAsync().GetAwaiter().GetResult()).SelfName ?? tenant.UserName ?? "HR";

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = db.EmployeeReferrals.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReferralStatus>(status, true, out var s)) q = q.Where(r => r.Status == s);
        var rows = await q.OrderByDescending(r => r.ReferredAt).ThenByDescending(r => r.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(ToDto));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var all = await db.EmployeeReferrals.AsNoTracking().ToListAsync(ct);
        int Count(ReferralStatus s) => all.Count(r => r.Status == s);
        return Ok(new
        {
            total = all.Count,
            active = all.Count(r => r.Status is not (ReferralStatus.Hired or ReferralStatus.NotSelected)),
            hired = Count(ReferralStatus.Hired),
            bonusPending = all.Where(r => r.Status == ReferralStatus.Hired && !r.BonusPaid).Sum(r => r.BonusAmount),
            bonusPaid = all.Where(r => r.BonusPaid).Sum(r => r.BonusAmount),
            funnel = new
            {
                @new = Count(ReferralStatus.New),
                inReview = Count(ReferralStatus.InReview),
                interviewing = Count(ReferralStatus.Interviewing),
                hired = Count(ReferralStatus.Hired),
                notSelected = Count(ReferralStatus.NotSelected)
            },
            topReferrers = all.GroupBy(r => r.Referrer).Select(g => new { referrer = g.Key, count = g.Count(), hired = g.Count(x => x.Status == ReferralStatus.Hired) }).OrderByDescending(x => x.count).Take(5)
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ReferralBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Referrer) || string.IsNullOrWhiteSpace(body.CandidateName))
            return BadRequest(new { message = "Referrer and candidate name are required." });
        var status = Enum.TryParse<ReferralStatus>(body.Status, true, out var s) ? s : ReferralStatus.New;
        var r = EmployeeReferral.Create(tenant.TenantId, body.Referrer!, body.CandidateName!, body.Position ?? "—",
            body.CandidateEmail, body.Department, status, null, body.BonusAmount ?? 50000m, body.Notes, Actor());
        db.EmployeeReferrals.Add(r);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(r));
    }

    [HttpPost("{id:guid}/status")]
    public async Task<IActionResult> Move(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        if (!Enum.TryParse<ReferralStatus>(body.Status, true, out var s)) return BadRequest(new { message = "Invalid status." });
        var r = await db.EmployeeReferrals.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();
        r.MoveTo(s, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(r));
    }

    [HttpPost("{id:guid}/bonus-paid")]
    public async Task<IActionResult> BonusPaid(Guid id, CancellationToken ct)
    {
        var r = await db.EmployeeReferrals.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();
        r.MarkBonusPaid(Actor());
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(r));
    }

    private static object ToDto(EmployeeReferral r) => new
    {
        id = r.Id, referrer = r.Referrer, candidateName = r.CandidateName, candidateEmail = r.CandidateEmail,
        position = r.Position, department = r.Department, status = r.Status.ToString().ToLowerInvariant(),
        referredAt = r.ReferredAt, bonusAmount = r.BonusAmount, bonusPaid = r.BonusPaid, notes = r.Notes
    };

    public sealed record ReferralBody(string? Referrer, string? CandidateName, string? CandidateEmail, string? Position, string? Department, string? Status, decimal? BonusAmount, string? Notes);
    public sealed record StatusBody(string Status);
}
