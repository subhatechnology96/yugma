using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/provisioning")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class ProvisioningController(YugmaDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = db.ProvisioningRequests.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(r => r.Status == status.ToLowerInvariant());

        var rows = await q
            .OrderBy(r => r.Status == "pending" ? 0 : r.Status == "in_progress" ? 1 : 2)
            .ThenByDescending(r => r.RequestedAtUtc)
            .Select(r => new
            {
                id = r.Id,
                employeeId = r.EmployeeId,
                employeeName = r.EmployeeName,
                email = r.Email,
                department = r.Department,
                designation = r.Designation,
                location = r.Location,
                status = r.Status,
                requestedAt = r.RequestedAtUtc,
                completedAt = r.CompletedAtUtc,
                assignedTo = r.AssignedTo,
                notes = r.Notes
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var counts = await db.ProvisioningRequests.AsNoTracking()
            .GroupBy(r => r.Status)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToListAsync(ct);
        var oldestPending = await db.ProvisioningRequests.AsNoTracking()
            .Where(r => r.Status == "pending")
            .OrderBy(r => r.RequestedAtUtc)
            .Select(r => (DateTime?)r.RequestedAtUtc)
            .FirstOrDefaultAsync(ct);
        return Ok(new { counts, oldestPending });
    }

    public sealed record UpdateStatusBody(string Status, string? AssignedTo, string? Notes);

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusBody body, CancellationToken ct)
    {
        var req = await db.ProvisioningRequests.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (req is null) return NotFound();

        var s = body.Status?.Trim().ToLowerInvariant();
        if (s is not ("pending" or "in_progress" or "completed" or "rejected"))
            return BadRequest(new { error = "invalid_status", message = "Status must be pending, in_progress, completed or rejected." });

        req.Status = s;
        if (!string.IsNullOrWhiteSpace(body.AssignedTo)) req.AssignedTo = body.AssignedTo.Trim();
        if (body.Notes is not null) req.Notes = body.Notes;
        req.CompletedAtUtc = (s == "completed" || s == "rejected") ? DateTime.UtcNow : null;

        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = req.Id,
            employeeId = req.EmployeeId,
            employeeName = req.EmployeeName,
            email = req.Email,
            department = req.Department,
            designation = req.Designation,
            location = req.Location,
            status = req.Status,
            requestedAt = req.RequestedAtUtc,
            completedAt = req.CompletedAtUtc,
            assignedTo = req.AssignedTo,
            notes = req.Notes
        });
    }
}
