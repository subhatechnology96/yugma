using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/subscriptions")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class SubscriptionsController(YugmaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await db.ModuleSubscriptions.AsNoTracking()
            .OrderBy(s => s.ModuleName)
            .Select(s => new
            {
                id = s.Id,
                moduleKey = s.ModuleKey,
                moduleName = s.ModuleName,
                description = s.Description,
                icon = s.Icon,
                plan = s.Plan,
                status = s.Status,
                monthlyPrice = s.MonthlyPrice,
                billingCycle = s.BillingCycle,
                seats = s.Seats,
                seatsUsed = s.SeatsUsed,
                startedAt = s.StartedAt,
                renewsAt = s.RenewsAt,
                features = s.Features
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    public sealed record UpdateSubscriptionBody(
        string Plan,
        string Status,
        string BillingCycle,
        decimal MonthlyPrice,
        int Seats);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSubscriptionBody body, CancellationToken ct)
    {
        var sub = await db.ModuleSubscriptions.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sub is null) return NotFound();

        // Whitelist allowed values
        var planLower = body.Plan?.Trim().ToLowerInvariant() ?? sub.Plan;
        if (planLower is not ("starter" or "growth" or "enterprise"))
            return BadRequest(new { error = "invalid_plan", message = "Plan must be starter, growth or enterprise." });

        var statusLower = body.Status?.Trim().ToLowerInvariant() ?? sub.Status;
        if (statusLower is not ("active" or "trialing" or "paused" or "cancelled"))
            return BadRequest(new { error = "invalid_status", message = "Status must be active, trialing, paused or cancelled." });

        var cycleLower = body.BillingCycle?.Trim().ToLowerInvariant() ?? sub.BillingCycle;
        if (cycleLower is not ("monthly" or "annual"))
            return BadRequest(new { error = "invalid_cycle", message = "Billing cycle must be monthly or annual." });

        if (body.MonthlyPrice < 0) return BadRequest(new { error = "invalid_price" });
        if (body.Seats < 0) return BadRequest(new { error = "invalid_seats" });

        sub.Plan = planLower;
        sub.Status = statusLower;
        sub.BillingCycle = cycleLower;
        sub.MonthlyPrice = body.MonthlyPrice;
        sub.Seats = body.Seats;

        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = sub.Id,
            moduleKey = sub.ModuleKey,
            moduleName = sub.ModuleName,
            description = sub.Description,
            icon = sub.Icon,
            plan = sub.Plan,
            status = sub.Status,
            monthlyPrice = sub.MonthlyPrice,
            billingCycle = sub.BillingCycle,
            seats = sub.Seats,
            seatsUsed = sub.SeatsUsed,
            startedAt = sub.StartedAt,
            renewsAt = sub.RenewsAt,
            features = sub.Features
        });
    }
}
