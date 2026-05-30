using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/accounts/invoices")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class InvoicesController(YugmaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await db.Invoices.AsNoTracking()
            .OrderByDescending(i => i.IssuedAt)
            .Select(i => new
            {
                num = i.Number,
                customer = i.Customer,
                issued = i.IssuedAt,
                due = i.DueAt,
                amount = i.Amount,
                status = i.Status.ToString().ToLowerInvariant()
            })
            .ToListAsync(ct);
        return Ok(rows);
    }
}
