using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr.Recruiting;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work")]
[Produces("application/json")]
[Authorize] // Recruitment is HR/admin only — the action filter below blocks everyone else
public sealed class CandidatesController(YugmaDbContext db, ITenantContext tenant, HrAccess access) : ControllerBase, IAsyncActionFilter
{
    private static readonly string[] StageOrder = { "applied", "screening", "interview", "offer", "hired", "rejected" };

    /// <summary>Gates the entire controller: only HR / admins may use the recruitment endpoints.</summary>
    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if ((await access.ResolveAsync(context.HttpContext.RequestAborted)).Restricted)
        {
            context.Result = new ObjectResult(new { message = "Recruitment is available to HR and administrators only." })
            { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }
        await next();
    }

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
        return Ok(rows.Select(c => ToDto(c, includeResume: false)));
    }

    [HttpGet("candidates/{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var c = await db.Candidates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return c is null ? NotFound() : Ok(ToDto(c, includeResume: true));
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

        var by = await ActorAsync(ct);

        // Workflow steps captured as part of the move:
        //  • → Interview: an interviewer must be assigned (the "assign interviewer" step).
        //  • → Offer/Hired: interview feedback (who interviewed + verdict) is recorded.
        if (!string.IsNullOrWhiteSpace(body.Interviewer))
            c.AssignInterviewer(body.Interviewer!, body.InterviewAt, by);

        if (body.Feedback is { } fb && !string.IsNullOrWhiteSpace(fb.Interviewer))
            c.AddFeedback(fb.Interviewer, fb.Round, (byte)fb.Rating, fb.Recommendation, fb.Comments, by);

        c.MoveTo(stage, by, body.Note);

        // Hiring kicks off the post-hire onboarding process (documents → background → offer letter → acceptance).
        if (stage == CandidateStage.Hired)
            c.StartOnboarding(by);

        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    /// <summary>Assigns (or reassigns) the interviewer for a candidate, with an optional schedule. The Screening → Interview step.</summary>
    [HttpPost("candidates/{id:guid}/assign-interviewer")]
    public async Task<IActionResult> AssignInterviewer(Guid id, [FromBody] AssignInterviewerBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Interviewer))
            return BadRequest(new { message = "An interviewer is required." });
        var c = await db.Candidates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        c.AssignInterviewer(body.Interviewer, body.InterviewAt, await ActorAsync(ct), body.Note);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    /// <summary>Records an interview verdict (who interviewed, rating, recommendation, comments).</summary>
    [HttpPost("candidates/{id:guid}/feedback")]
    public async Task<IActionResult> AddFeedback(Guid id, [FromBody] FeedbackBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Interviewer))
            return BadRequest(new { message = "Interviewer is required." });
        var c = await db.Candidates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        c.AddFeedback(body.Interviewer, body.Round, (byte)body.Rating, body.Recommendation, body.Comments, await ActorAsync(ct));
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    /// <summary>Attaches (or clears, when url is null) a resume — a base64 data URL or an external link.</summary>
    [HttpPost("candidates/{id:guid}/resume")]
    public async Task<IActionResult> AttachResume(Guid id, [FromBody] ResumeBody body, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(body.Url) && body.Url!.Length > 6_000_000)
            return BadRequest(new { message = "Resume is too large. Please use a file under ~4 MB." });
        var c = await db.Candidates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        c.AttachResume(body.FileName, body.Url, await ActorAsync(ct));
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    // ---------------- post-hire onboarding ----------------

    /// <summary>Starts (or re-affirms) the post-hire onboarding process for a hired candidate.</summary>
    [HttpPost("candidates/{id:guid}/onboarding/start")]
    public Task<IActionResult> StartOnboarding(Guid id, CancellationToken ct)
        => Onboard(id, (c, by) => c.StartOnboarding(by), ct);

    /// <summary>Updates one onboarding document's verification status (pending | received | verified | rejected).</summary>
    [HttpPost("candidates/{id:guid}/onboarding/document")]
    public Task<IActionResult> OnboardingDocument(Guid id, [FromBody] DocumentBody body, CancellationToken ct)
        => string.IsNullOrWhiteSpace(body.Name)
            ? Task.FromResult<IActionResult>(BadRequest(new { message = "Document name is required." }))
            : Onboard(id, (c, by) => c.SetDocument(body.Name, body.Status, body.Note, by), ct);

    /// <summary>Records the background-check outcome (in_progress | cleared | flagged). Clearing it unlocks the offer letter.</summary>
    [HttpPost("candidates/{id:guid}/onboarding/background-check")]
    public Task<IActionResult> BackgroundCheck(Guid id, [FromBody] BackgroundBody body, CancellationToken ct)
        => Onboard(id, (c, by) => c.UpdateBackgroundCheck(body.Status, body.Provider, body.Note, by), ct);

    /// <summary>Releases the offer letter (document + joining date + CTC), moving to the candidate's acceptance.</summary>
    [HttpPost("candidates/{id:guid}/onboarding/offer-letter")]
    public Task<IActionResult> OfferLetter(Guid id, [FromBody] OfferLetterBody body, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(body.Url) && body.Url!.Length > 6_000_000)
            return Task.FromResult<IActionResult>(BadRequest(new { message = "Offer letter is too large. Please use a file under ~4 MB." }));
        return Onboard(id, (c, by) => c.ReleaseOfferLetter(body.FileName, body.Url, body.JoiningDate, body.CtcLakhs, by), ct);
    }

    /// <summary>Records the candidate's response to the offer letter (accepted | declined).</summary>
    [HttpPost("candidates/{id:guid}/onboarding/acceptance")]
    public Task<IActionResult> Acceptance(Guid id, [FromBody] AcceptanceBody body, CancellationToken ct)
        => Onboard(id, (c, by) => c.RecordAcceptance(body.Status, body.Note, body.JoiningDate, by), ct);

    private async Task<IActionResult> Onboard(Guid id, Action<Candidate, string> apply, CancellationToken ct)
    {
        var c = await db.Candidates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        apply(c, await ActorAsync(ct));
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    /// <summary>The acting user's display name for audit/timeline entries.</summary>
    private async Task<string> ActorAsync(CancellationToken ct)
        => (await access.ResolveAsync(ct)).SelfName ?? tenant.UserName ?? "Recruiter";

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
    // includeResume=false omits the (potentially large base64) resume payload — used for the board/list.
    private static object ToDto(Candidate c, bool includeResume = true) => new
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
        owner = c.Owner,
        resumeFileName = c.ResumeFileName,
        hasResume = !string.IsNullOrEmpty(c.ResumeUrl),
        resumeUrl = includeResume ? c.ResumeUrl : null,
        interviewer = c.Interviewer,
        interviewScheduledAt = c.InterviewScheduledAt,
        feedback = c.Feedback
            .OrderByDescending(f => f.At)
            .Select(f => new { interviewer = f.Interviewer, round = f.Round, rating = (int)f.Rating, recommendation = f.Recommendation, comments = f.Comments, at = f.At }),
        activity = c.Activity
            .OrderByDescending(a => a.At)
            .Select(a => new { kind = a.Kind, from = a.From, to = a.To, note = a.Note, by = a.By, at = a.At }),
        onboarding = c.Onboarding is null ? null : OnboardingDto(c.Onboarding, includeResume)
    };

    private static object OnboardingDto(Onboarding o, bool includeOfferDoc) => new
    {
        step = o.Step.ToString(),
        startedAt = o.StartedAt,
        documents = o.Documents.Select(d => new { name = d.Name, status = d.Status, note = d.Note, by = d.By, at = d.At }),
        documentsVerified = o.Documents.Count(d => d.Status == "verified"),
        documentsTotal = o.Documents.Count,
        background = new { status = o.BackgroundStatus, provider = o.BackgroundProvider, note = o.BackgroundNote, at = o.BackgroundAt },
        offer = new
        {
            status = o.OfferStatus,
            fileName = o.OfferFileName,
            hasLetter = !string.IsNullOrEmpty(o.OfferUrl),
            url = includeOfferDoc ? o.OfferUrl : null,
            joiningDate = o.JoiningDate,
            ctcLakhs = o.OfferCtcLakhs,
            releasedAt = o.OfferReleasedAt
        },
        acceptance = new { status = o.AcceptanceStatus, note = o.AcceptanceNote, at = o.AcceptanceAt }
    };

    public sealed record CandidateBody(string Name, string Role, string? Source, string? Stage, int Rating, string? Email, string? Location, int ExperienceYears, decimal ExpectedCtcLakhs, string? Owner);
    public sealed record MoveBody(string Stage, string? Note = null, string? Interviewer = null, DateOnly? InterviewAt = null, FeedbackBody? Feedback = null);
    public sealed record AssignInterviewerBody(string Interviewer, DateOnly? InterviewAt = null, string? Note = null);
    public sealed record FeedbackBody(string Interviewer, string? Round, int Rating, string Recommendation, string? Comments);
    public sealed record ResumeBody(string? FileName, string? Url);
    public sealed record DocumentBody(string Name, string Status, string? Note);
    public sealed record BackgroundBody(string Status, string? Provider, string? Note);
    public sealed record OfferLetterBody(string? FileName, string? Url, DateOnly? JoiningDate, decimal? CtcLakhs);
    public sealed record AcceptanceBody(string Status, string? Note, DateOnly? JoiningDate);
}
