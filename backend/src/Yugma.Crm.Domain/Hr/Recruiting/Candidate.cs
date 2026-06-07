using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Recruiting;

public enum CandidateStage { Applied, Screening, Interview, Offer, Hired, Rejected }

/// <summary>One interviewer's verdict on a candidate (a single interview round). Stored as JSON on the candidate.</summary>
public sealed class InterviewFeedback
{
    public string Interviewer { get; set; } = default!;
    public string? Round { get; set; }                 // e.g. "Screening", "Technical", "HR", "Hiring manager"
    public byte Rating { get; set; }                    // 1..5
    public string Recommendation { get; set; } = "Proceed"; // Strong yes | Proceed | Hold | Reject
    public string? Comments { get; set; }
    public DateTime At { get; set; }
}

/// <summary>One workflow step in a candidate's journey (stage move, assignment, feedback). Stored as JSON.</summary>
public sealed class StageEvent
{
    public string Kind { get; set; } = "move";          // move | assign | feedback | resume | note | onboarding
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Note { get; set; }
    public string? By { get; set; }
    public DateTime At { get; set; }
}

// ---- post-hire onboarding ----

/// <summary>The post-hire steps, in order: verify documents → background check → release offer letter → candidate decision.</summary>
public enum OnboardingStep { Documents, BackgroundCheck, OfferLetter, Acceptance, Completed }

/// <summary>One document the new hire must provide / that HR must verify.</summary>
public sealed class OnboardingDocument
{
    public string Name { get; set; } = default!;
    public string Status { get; set; } = "pending";     // pending | received | verified | rejected
    public string? Note { get; set; }
    public string? By { get; set; }
    public DateTime? At { get; set; }
}

/// <summary>The full post-hire onboarding record for a candidate (created when they are moved to Hired).</summary>
public sealed class Onboarding
{
    public OnboardingStep Step { get; set; } = OnboardingStep.Documents;
    public DateTime StartedAt { get; set; }

    /// <summary>Document checklist to verify.</summary>
    public List<OnboardingDocument> Documents { get; set; } = new();

    /// <summary>Background verification.</summary>
    public string BackgroundStatus { get; set; } = "not_started"; // not_started | in_progress | cleared | flagged
    public string? BackgroundProvider { get; set; }
    public string? BackgroundNote { get; set; }
    public DateTime? BackgroundAt { get; set; }

    /// <summary>Offer letter.</summary>
    public string OfferStatus { get; set; } = "not_released";     // not_released | released
    public string? OfferFileName { get; set; }
    public string? OfferUrl { get; set; }                          // data URL or link
    public DateOnly? JoiningDate { get; set; }
    public decimal? OfferCtcLakhs { get; set; }
    public DateTime? OfferReleasedAt { get; set; }

    /// <summary>Candidate's response to the offer letter.</summary>
    public string AcceptanceStatus { get; set; } = "pending";     // pending | accepted | declined
    public string? AcceptanceNote { get; set; }
    public DateTime? AcceptanceAt { get; set; }

    public bool AllDocumentsVerified => Documents.Count > 0 && Documents.All(d => d.Status is "verified");
}

public sealed class Candidate : Entity<Guid>, IAggregateRoot
{
    public string Name { get; set; } = default!;
    public string Role { get; set; } = default!;
    public string Source { get; set; } = default!;
    public CandidateStage Stage { get; set; }
    public byte Rating { get; set; }
    public DateOnly AppliedAt { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public int ExperienceYears { get; set; }
    public decimal ExpectedCtcLakhs { get; set; }
    public string? Owner { get; set; }
    public DateOnly LastActivityAt { get; set; }

    // ---- recruitment workflow ----
    /// <summary>Original file name of the attached resume (for display/download).</summary>
    public string? ResumeFileName { get; set; }
    /// <summary>Resume as an external URL or an uploaded file encoded as a base64 data URL (text column).</summary>
    public string? ResumeUrl { get; set; }
    /// <summary>The employee currently assigned to interview this candidate.</summary>
    public string? Interviewer { get; set; }
    /// <summary>When the assigned interview is scheduled.</summary>
    public DateOnly? InterviewScheduledAt { get; set; }
    /// <summary>Interview verdicts, one per round/interviewer.</summary>
    public List<InterviewFeedback> Feedback { get; set; } = new();
    /// <summary>Workflow timeline — every stage move/assignment/feedback, newest appended last.</summary>
    public List<StageEvent> Activity { get; set; } = new();

    /// <summary>Post-hire onboarding (documents → background → offer letter → acceptance). Null until the candidate is hired.</summary>
    public Onboarding? Onboarding { get; set; }

    public static Candidate Create(
        Guid tenantId, string name, string role, string source, CandidateStage stage, byte rating, DateOnly appliedAt,
        string? email = null, string? location = null, int experienceYears = 0, decimal expectedCtcLakhs = 0, string? owner = null,
        DateOnly? lastActivityAt = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            Role = role,
            Source = source,
            Stage = stage,
            Rating = rating,
            AppliedAt = appliedAt,
            Email = email,
            Location = location,
            ExperienceYears = experienceYears,
            ExpectedCtcLakhs = expectedCtcLakhs,
            Owner = owner,
            LastActivityAt = lastActivityAt ?? appliedAt,
            CreatedAt = DateTime.UtcNow
        };

    public void MoveTo(CandidateStage stage, string? by, string? note = null)
    {
        var from = Stage;
        Stage = stage;
        LastActivityAt = DateOnly.FromDateTime(DateTime.UtcNow);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
        Activity.Add(new StageEvent
        {
            Kind = "move",
            From = from.ToString().ToLowerInvariant(),
            To = stage.ToString().ToLowerInvariant(),
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            By = by,
            At = DateTime.UtcNow
        });
    }

    /// <summary>Assigns an interviewer (and optional schedule) and logs it to the timeline.</summary>
    public void AssignInterviewer(string interviewer, DateOnly? scheduledAt, string? by, string? note = null)
    {
        Interviewer = interviewer.Trim();
        InterviewScheduledAt = scheduledAt;
        LastActivityAt = DateOnly.FromDateTime(DateTime.UtcNow);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
        var when = scheduledAt is { } d ? $" for {d:dd MMM yyyy}" : "";
        Activity.Add(new StageEvent
        {
            Kind = "assign",
            Note = string.IsNullOrWhiteSpace(note) ? $"Assigned {interviewer.Trim()}{when}" : note.Trim(),
            By = by,
            At = DateTime.UtcNow
        });
    }

    /// <summary>Records an interview verdict, refreshes the headline rating to the latest, and logs it.</summary>
    public void AddFeedback(string interviewer, string? round, byte rating, string recommendation, string? comments, string? by)
    {
        rating = (byte)Math.Clamp((int)rating, 1, 5);
        Feedback.Add(new InterviewFeedback
        {
            Interviewer = interviewer.Trim(),
            Round = string.IsNullOrWhiteSpace(round) ? null : round.Trim(),
            Rating = rating,
            Recommendation = string.IsNullOrWhiteSpace(recommendation) ? "Proceed" : recommendation.Trim(),
            Comments = string.IsNullOrWhiteSpace(comments) ? null : comments.Trim(),
            At = DateTime.UtcNow
        });
        Rating = rating;
        LastActivityAt = DateOnly.FromDateTime(DateTime.UtcNow);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
        Activity.Add(new StageEvent
        {
            Kind = "feedback",
            Note = $"{interviewer.Trim()}: {(string.IsNullOrWhiteSpace(recommendation) ? "Proceed" : recommendation.Trim())} ({rating}★)",
            By = by,
            At = DateTime.UtcNow
        });
    }

    /// <summary>Attaches a resume (data URL or external link) and logs it.</summary>
    public void AttachResume(string? fileName, string? url, string? by)
    {
        ResumeFileName = string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim();
        ResumeUrl = string.IsNullOrWhiteSpace(url) ? null : url.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
        Activity.Add(new StageEvent
        {
            Kind = "resume",
            Note = ResumeUrl is null ? "Removed resume" : $"Attached resume{(ResumeFileName is null ? "" : $" ({ResumeFileName})")}",
            By = by,
            At = DateTime.UtcNow
        });
    }

    // ---- post-hire onboarding ----

    /// <summary>Default document checklist a new hire must submit for verification.</summary>
    private static readonly string[] DefaultOnboardingDocuments =
    {
        "Photo ID (Aadhaar / PAN)",
        "Address proof",
        "Educational certificates",
        "Previous employment / relieving letter",
        "Last 3 months' salary slips",
        "Passport-size photographs"
    };

    /// <summary>Creates the onboarding record (document checklist + first step) if it doesn't exist yet. Called when the candidate is hired.</summary>
    public void StartOnboarding(string? by)
    {
        if (Onboarding is not null) return;
        Onboarding = new Onboarding
        {
            Step = OnboardingStep.Documents,
            StartedAt = DateTime.UtcNow,
            Documents = DefaultOnboardingDocuments.Select(d => new OnboardingDocument { Name = d, Status = "pending" }).ToList()
        };
        LogOnboarding("Onboarding started — document verification pending", by);
    }

    /// <summary>Sets the status of one onboarding document (adding it if new). Advances to background check once all are verified.</summary>
    public void SetDocument(string name, string status, string? note, string? by)
    {
        var ob = Onboarding ??= new Onboarding { Step = OnboardingStep.Documents, StartedAt = DateTime.UtcNow };
        var doc = ob.Documents.FirstOrDefault(d => string.Equals(d.Name, name.Trim(), StringComparison.OrdinalIgnoreCase));
        if (doc is null) { doc = new OnboardingDocument { Name = name.Trim() }; ob.Documents.Add(doc); }
        doc.Status = string.IsNullOrWhiteSpace(status) ? "pending" : status.Trim().ToLowerInvariant();
        doc.Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        doc.By = by;
        doc.At = DateTime.UtcNow;
        if (ob.Step == OnboardingStep.Documents && ob.AllDocumentsVerified) ob.Step = OnboardingStep.BackgroundCheck;
        LogOnboarding($"Document '{doc.Name}' marked {doc.Status}", by);
    }

    /// <summary>Records the background-check outcome. A cleared check advances to the offer-letter step.</summary>
    public void UpdateBackgroundCheck(string status, string? provider, string? note, string? by)
    {
        var ob = Onboarding ??= new Onboarding { StartedAt = DateTime.UtcNow };
        ob.BackgroundStatus = string.IsNullOrWhiteSpace(status) ? "in_progress" : status.Trim().ToLowerInvariant();
        ob.BackgroundProvider = string.IsNullOrWhiteSpace(provider) ? ob.BackgroundProvider : provider.Trim();
        ob.BackgroundNote = string.IsNullOrWhiteSpace(note) ? ob.BackgroundNote : note.Trim();
        ob.BackgroundAt = DateTime.UtcNow;
        if (ob.BackgroundStatus == "cleared" && ob.Step is OnboardingStep.Documents or OnboardingStep.BackgroundCheck)
            ob.Step = OnboardingStep.OfferLetter;
        LogOnboarding($"Background check: {ob.BackgroundStatus}{(provider is null ? "" : $" ({provider})")}", by);
    }

    /// <summary>Releases the offer letter (document + joining date + CTC) and moves to awaiting the candidate's acceptance.</summary>
    public void ReleaseOfferLetter(string? fileName, string? url, DateOnly? joiningDate, decimal? ctcLakhs, string? by)
    {
        var ob = Onboarding ??= new Onboarding { StartedAt = DateTime.UtcNow };
        ob.OfferStatus = "released";
        ob.OfferFileName = string.IsNullOrWhiteSpace(fileName) ? ob.OfferFileName : fileName.Trim();
        ob.OfferUrl = string.IsNullOrWhiteSpace(url) ? ob.OfferUrl : url.Trim();
        ob.JoiningDate = joiningDate ?? ob.JoiningDate;
        ob.OfferCtcLakhs = ctcLakhs ?? ob.OfferCtcLakhs;
        ob.OfferReleasedAt = DateTime.UtcNow;
        if (ob.Step != OnboardingStep.Completed) ob.Step = OnboardingStep.Acceptance;
        LogOnboarding($"Offer letter released{(joiningDate is { } d ? $" — joining {d:dd MMM yyyy}" : "")}", by);
    }

    /// <summary>Records the candidate's response to the offer letter. Acceptance completes onboarding.</summary>
    public void RecordAcceptance(string status, string? note, DateOnly? joiningDate, string? by)
    {
        var ob = Onboarding ??= new Onboarding { StartedAt = DateTime.UtcNow };
        ob.AcceptanceStatus = string.IsNullOrWhiteSpace(status) ? "pending" : status.Trim().ToLowerInvariant();
        ob.AcceptanceNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ob.AcceptanceAt = DateTime.UtcNow;
        if (joiningDate is { } jd) ob.JoiningDate = jd;
        if (ob.AcceptanceStatus == "accepted") ob.Step = OnboardingStep.Completed;
        LogOnboarding($"Candidate {ob.AcceptanceStatus} the offer", by);
    }

    private void LogOnboarding(string note, string? by)
    {
        LastActivityAt = DateOnly.FromDateTime(DateTime.UtcNow);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
        Activity.Add(new StageEvent { Kind = "onboarding", Note = note, By = by, At = DateTime.UtcNow });
    }

    public void Update(string name, string role, string source, byte rating, string? email, string? location, int experienceYears, decimal expectedCtcLakhs, string? owner)
    {
        Name = name;
        Role = role;
        Source = source;
        Rating = rating;
        Email = email;
        Location = location;
        ExperienceYears = experienceYears;
        ExpectedCtcLakhs = expectedCtcLakhs;
        Owner = owner;
        UpdatedAt = DateTime.UtcNow;
    }
}
