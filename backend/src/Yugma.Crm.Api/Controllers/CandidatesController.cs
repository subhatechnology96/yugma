using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr.Recruiting;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/hr")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class CandidatesController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
    private static readonly string[] StageOrder = { "applied", "screening", "interview", "offer", "hired", "rejected" };

    // ---------------- candidates ----------------
    [HttpGet("candidates")]
    public async Task<IActionResult> List([FromQuery] string? stage = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.Candidates.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<CandidateStage>(stage, true, out var s))
            q = q.Where(c => c.Stage == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var t = search.Trim();
            q = q.Where(c => EF.Functions.ILike(c.Name, $"%{t}%") || EF.Functions.ILike(c.Role, $"%{t}%") || EF.Functions.ILike(c.Source, $"%{t}%"));
        }
        var rows = await q.OrderByDescending(c => c.AppliedAt).ToListAsync(ct);
        return Ok(rows.Select(ToDto));
    }

    [HttpGet("candidates/summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var candidates = await db.Candidates.AsNoTracking().ToListAsync(ct);
        var jobs = await db.JobOpenings.AsNoTracking().ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var quarterStart = new DateOnly(today.Year, ((today.Month - 1) / 3) * 3 + 1, 1);

        int Count(CandidateStage st) => candidates.Count(c => c.Stage == st);
        var active = candidates.Count(c => c.Stage is not (CandidateStage.Hired or CandidateStage.Rejected));
        var openJobs = jobs.Where(j => j.Status == JobStatus.Open).ToList();

        var bySource = candidates
            .GroupBy(c => c.Source)
            .Select(g => new { source = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        return Ok(new
        {
            openRoles = openJobs.Count,
            openPositions = openJobs.Sum(j => j.Openings),
            departments = openJobs.Select(j => j.Department).Distinct().Count(),
            inPipeline = active,
            offersOut = Count(CandidateStage.Offer),
            hiredQtd = candidates.Count(c => c.Stage == CandidateStage.Hired && c.LastActivityAt >= quarterStart),
            funnel = new
            {
                applied = Count(CandidateStage.Applied),
                screening = Count(CandidateStage.Screening),
                interview = Count(CandidateStage.Interview),
                offer = Count(CandidateStage.Offer),
                hired = Count(CandidateStage.Hired),
                rejected = Count(CandidateStage.Rejected)
            },
            bySource
        });
    }

    [HttpPost("candidates")]
    public async Task<IActionResult> Create([FromBody] CandidateBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Role))
            return BadRequest(new { message = "Name and role are required." });

        var stage = Enum.TryParse<CandidateStage>(body.Stage ?? "Applied", true, out var st) ? st : CandidateStage.Applied;
        var c = Candidate.Create(tenant.TenantId, body.Name.Trim(), body.Role.Trim(), body.Source?.Trim() ?? "Inbound",
            stage, (byte)Math.Clamp(body.Rating, 1, 5), DateOnly.FromDateTime(DateTime.UtcNow),
            body.Email?.Trim(), body.Location?.Trim(), Math.Max(0, body.ExperienceYears), Math.Max(0, body.ExpectedCtcLakhs), body.Owner?.Trim());
        db.Candidates.Add(c);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    [HttpPost("candidates/{id:guid}/stage")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveBody body, CancellationToken ct)
    {
        if (!Enum.TryParse<CandidateStage>(body.Stage, true, out var stage))
            return BadRequest(new { message = "Invalid stage." });
        var c = await db.Candidates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        c.MoveTo(stage, "Recruiter");
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    [HttpPut("candidates/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CandidateBody body, CancellationToken ct)
    {
        var c = await db.Candidates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        c.Update(body.Name.Trim(), body.Role.Trim(), body.Source?.Trim() ?? c.Source, (byte)Math.Clamp(body.Rating, 1, 5),
            body.Email?.Trim(), body.Location?.Trim(), Math.Max(0, body.ExperienceYears), Math.Max(0, body.ExpectedCtcLakhs), body.Owner?.Trim());
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    // ---------------- job openings ----------------
    [HttpGet("roles")]
    public async Task<IActionResult> Roles(CancellationToken ct)
    {
        var jobs = await db.JobOpenings.AsNoTracking().ToListAsync(ct);
        var candidates = await db.Candidates.AsNoTracking().ToListAsync(ct);

        var rows = jobs
            .OrderBy(j => j.Status).ThenByDescending(j => j.PostedAt)
            .Select(j => new
            {
                id = j.Id,
                title = j.Title,
                department = j.Department,
                location = j.Location,
                employmentType = j.EmploymentType,
                openings = j.Openings,
                status = j.Status.ToString(),
                priority = j.Priority,
                hiringManager = j.HiringManager,
                budgetCtcLakhs = j.BudgetCtcLakhs,
                postedAt = j.PostedAt,
                applicants = candidates.Count(c => c.Role == j.Title),
                inPipeline = candidates.Count(c => c.Role == j.Title && c.Stage is not (CandidateStage.Hired or CandidateStage.Rejected))
            });
        return Ok(rows);
    }

    // ---------------- helpers ----------------
    private static object ToDto(Candidate c) => new
    {
        id = c.Id,
        name = c.Name,
        role = c.Role,
        source = c.Source,
        stage = c.Stage.ToString().ToLowerInvariant(),
        rating = (int)c.Rating,
        appliedAt = c.AppliedAt,
        lastActivityAt = c.LastActivityAt,
        email = c.Email,
        location = c.Location,
        experienceYears = c.ExperienceYears,
        expectedCtcLakhs = c.ExpectedCtcLakhs,
        owner = c.Owner
    };

    public sealed record CandidateBody(string Name, string Role, string? Source, string? Stage, int Rating, string? Email, string? Location, int ExperienceYears, decimal ExpectedCtcLakhs, string? Owner);
    public sealed record MoveBody(string Stage);
}
