using Yugma.Crm.Api.Access;
using Yugma.Crm.Api.Performance;
using Yugma.Crm.Domain.Hr.Performance;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/performance")]
[Produces("application/json")]
[Authorize] // HR/admins see the org tracker; everyone else sees only their own performance
public sealed class PerformanceController(YugmaDbContext db, HrAccess access) : ControllerBase
{
    private static IActionResult Forbidden(string message) =>
        new ObjectResult(new { message }) { StatusCode = StatusCodes.Status403Forbidden };
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private async Task<Dictionary<string, PerformanceReview>> OverridesAsync(Guid? employeeId, CancellationToken ct)
    {
        var q = db.PerformanceReviews.AsNoTracking();
        if (employeeId.HasValue) q = q.Where(r => r.EmployeeId == employeeId.Value);
        var rows = await q.ToListAsync(ct);
        return rows.ToDictionary(r => PerformanceFactory.Key(r.EmployeeId, r.Year, r.Quarter));
    }

    /// <summary>The competency catalog, read from the competencies table.</summary>
    private async Task<List<string>> CompetenciesAsync(CancellationToken ct) =>
        await db.Competencies.AsNoTracking().OrderBy(c => c.SortOrder).Select(c => c.Name).ToListAsync(ct);

    // Which employee ids the response is restricted to. scope=team → the caller's reports only (excludes
    // self, and HR/admins get their own reports rather than the whole org) for the "My Team" screens;
    // otherwise the default visibility (self + team, or everyone for HR/admins). null = no restriction.
    private static IReadOnlySet<Guid>? RestrictSet(HrAccessResult acc, string? scope) =>
        string.Equals(scope, "team", StringComparison.OrdinalIgnoreCase) ? acc.ManagedIds : acc.VisibleIds;

    [HttpGet("summary")]
    [ProducesResponseType(typeof(PerfSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Summary([FromQuery] int? year = null, [FromQuery] string? scope = null, CancellationToken ct = default)
    {
        var acc = await access.ResolveAsync(ct);
        var employees = await db.Employees.AsNoTracking().ToListAsync(ct);
        if (RestrictSet(acc, scope) is { } vis) employees = employees.Where(e => vis.Contains(e.Id)).ToList();
        var ov = await OverridesAsync(null, ct);
        return Ok(PerformanceFactory.BuildSummary(employees, year ?? Today.Year, Today, await CompetenciesAsync(ct), ov));
    }

    [HttpGet("tracker")]
    [ProducesResponseType(typeof(IReadOnlyList<PerfTrackerRowDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Tracker([FromQuery] string? search = null, [FromQuery] string? scope = null, CancellationToken ct = default)
    {
        var q = db.Employees.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var t = search.Trim();
            q = q.Where(e => EF.Functions.ILike(e.Name.First + " " + e.Name.Last, $"%{t}%")
                || EF.Functions.ILike(e.Department, $"%{t}%")
                || EF.Functions.ILike(e.Designation, $"%{t}%"));
        }
        var acc = await access.ResolveAsync(ct);
        var employees = await q.ToListAsync(ct);
        if (RestrictSet(acc, scope) is { } vis) employees = employees.Where(e => vis.Contains(e.Id)).ToList();
        var ov = await OverridesAsync(null, ct);
        return Ok(PerformanceFactory.BuildTracker(employees, Today, await CompetenciesAsync(ct), ov));
    }

    [HttpGet("employee/{id:guid}")]
    [ProducesResponseType(typeof(PerfEmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Employee(Guid id, CancellationToken ct)
    {
        var acc = await access.ResolveAsync(ct);
        if (!acc.CanSeeEmployee(id))
            return Forbidden("You can only view your own or your team's performance.");
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound();
        var ov = await OverridesAsync(id, ct);
        return Ok(PerformanceFactory.BuildEmployee(emp, Today, await CompetenciesAsync(ct), ov));
    }

    /// <summary>Create or update a manual review for an employee's quarter (Admin / HR / manager).</summary>
    [HttpPut("employee/{id:guid}/review")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpsertReview(Guid id, [FromBody] ReviewBody body, CancellationToken ct)
    {
        if (!(await access.ResolveAsync(ct)).CanManageEmployee(id))
            return Forbidden("You can only review your own team.");
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound(new { message = "Employee not found." });
        if (body.Quarter is < 1 or > 4) return BadRequest(new { message = "Quarter must be 1–4." });

        var competencyCount = await db.Competencies.CountAsync(ct);
        var rating = (decimal)Math.Clamp(body.Rating, 1, 5);
        var comps = (body.Competencies is not null && body.Competencies.Length == competencyCount)
            ? string.Join(',', body.Competencies.Select(c => Math.Clamp(c, 1, 5)))
            : string.Join(',', Enumerable.Repeat(3, competencyCount));
        var status = string.IsNullOrWhiteSpace(body.Status) ? "Calibrated" : body.Status.Trim();

        var existing = await db.PerformanceReviews
            .FirstOrDefaultAsync(r => r.EmployeeId == id && r.Year == body.Year && r.Quarter == body.Quarter, ct);
        if (existing is null)
            db.PerformanceReviews.Add(PerformanceReview.Create(emp.TenantId, id, body.Year, body.Quarter,
                rating, Math.Clamp(body.GoalProgress, 0, 100), status, body.Reviewer?.Trim(), body.Summary?.Trim(), comps, body.EditedBy ?? "Reviewer"));
        else
            existing.Update(rating, Math.Clamp(body.GoalProgress, 0, 100), status, body.Reviewer?.Trim(), body.Summary?.Trim(), comps, body.EditedBy ?? "Reviewer");

        await db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    /// <summary>Remove a manual review so the quarter reverts to the calibrated/system value.</summary>
    [HttpDelete("employee/{id:guid}/review")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetReview(Guid id, [FromQuery] int year, [FromQuery] int quarter, CancellationToken ct)
    {
        if (!(await access.ResolveAsync(ct)).CanManageEmployee(id))
            return Forbidden("You can only change your own team's review.");
        var existing = await db.PerformanceReviews.FirstOrDefaultAsync(r => r.EmployeeId == id && r.Year == year && r.Quarter == quarter, ct);
        if (existing is not null) { db.PerformanceReviews.Remove(existing); await db.SaveChangesAsync(ct); }
        return NoContent();
    }

    public sealed record ReviewBody(int Year, int Quarter, double Rating, int GoalProgress, string? Status, string? Reviewer, string? Summary, int[]? Competencies, string? EditedBy);
}
