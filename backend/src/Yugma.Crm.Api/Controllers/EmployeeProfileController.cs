using Yugma.Crm.Api.Profile;
using Yugma.Crm.Domain.Hr.Career;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

/// <summary>
/// Rich, presentation-ready profile sections for a single employee:
/// overview, attendance, leave, payroll and documents.
/// </summary>
[ApiController]
[Route("api/hr/employees")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class EmployeeProfileController(YugmaDbContext db) : ControllerBase
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    [HttpGet("{id:guid}/overview")]
    [ProducesResponseType(typeof(EmployeeOverviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Overview(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound();
        var profile = await db.EmployeeProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.EmployeeId == id, ct);
        return Ok(EmployeeProfileFactory.BuildOverview(emp, Today, profile));
    }

    [HttpGet("{id:guid}/attendance")]
    [ProducesResponseType(typeof(AttendanceOverviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Attendance(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        return emp is null ? NotFound() : Ok(EmployeeProfileFactory.BuildAttendance(emp, Today));
    }

    [HttpGet("{id:guid}/leave")]
    [ProducesResponseType(typeof(LeaveOverviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Leave(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        return emp is null ? NotFound() : Ok(EmployeeProfileFactory.BuildLeave(emp, Today));
    }

    [HttpGet("{id:guid}/payroll")]
    [ProducesResponseType(typeof(PayrollOverviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Payroll(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        return emp is null ? NotFound() : Ok(EmployeeProfileFactory.BuildPayroll(emp, Today));
    }

    [HttpGet("{id:guid}/documents")]
    [ProducesResponseType(typeof(IReadOnlyList<EmployeeDocumentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Documents(Guid id, CancellationToken ct)
    {
        var docs = await db.EmployeeDocuments
            .AsNoTracking()
            .Where(d => d.EmployeeId == id)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new EmployeeDocumentDto(
                d.Id, d.Name, d.Category, d.FileType, d.SizeBytes,
                d.Status.ToString(), d.UploadedAt, d.ExpiresAt, d.UploadedBy))
            .ToListAsync(ct);

        return Ok(docs);
    }

    // ---------------- career / professional history ----------------
    [HttpGet("{id:guid}/career")]
    [ProducesResponseType(typeof(CareerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Career(Guid id, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound();
        var custom = await db.EmployeeProjects.AsNoTracking().Where(p => p.EmployeeId == id).ToListAsync(ct);
        return Ok(CareerFactory.Build(emp, Today, custom));
    }

    [HttpPost("{id:guid}/projects")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> AddProject(Guid id, [FromBody] ProjectBody body, CancellationToken ct)
    {
        var emp = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (emp is null) return NotFound();
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { message = "Project name is required." });

        var p = EmployeeProject.Create(emp.TenantId, id, body.Name, body.Domain ?? "Project", body.Role ?? emp.Designation, body.Manager,
            body.StartDate, body.EndDate, NormalizeStatus(body.Status, body.EndDate), body.Rating,
            body.Responsibilities, body.Outcome, body.Feedback, body.Skills, body.TeamSize, "Self");
        db.EmployeeProjects.Add(p);
        await db.SaveChangesAsync(ct);
        return Ok(new { id = p.Id });
    }

    [HttpPut("projects/{projectId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateProject(Guid projectId, [FromBody] ProjectBody body, CancellationToken ct)
    {
        var p = await db.EmployeeProjects.FirstOrDefaultAsync(x => x.Id == projectId, ct);
        if (p is null) return NotFound();
        p.Update(body.Name, body.Domain ?? p.Domain, body.Role ?? p.Role, body.Manager, body.StartDate, body.EndDate,
            NormalizeStatus(body.Status, body.EndDate), body.Rating, body.Responsibilities, body.Outcome, body.Feedback, body.Skills, body.TeamSize, "Self");
        await db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    [HttpDelete("projects/{projectId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteProject(Guid projectId, CancellationToken ct)
    {
        var p = await db.EmployeeProjects.FirstOrDefaultAsync(x => x.Id == projectId, ct);
        if (p is not null) { db.EmployeeProjects.Remove(p); await db.SaveChangesAsync(ct); }
        return NoContent();
    }

    private static string NormalizeStatus(string? status, DateOnly? endDate)
    {
        if (!string.IsNullOrWhiteSpace(status)) return status.Trim();
        return endDate is null ? "Ongoing" : "Completed";
    }

    public sealed record ProjectBody(string Name, string? Domain, string? Role, string? Manager, DateOnly StartDate, DateOnly? EndDate,
        string? Status, int Rating, string? Responsibilities, string? Outcome, string? Feedback, string? Skills, int TeamSize);
}
