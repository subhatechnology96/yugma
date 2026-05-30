using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Recruiting;

public enum CandidateStage { Applied, Screening, Interview, Offer, Hired, Rejected }

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

    public void MoveTo(CandidateStage stage, string? by)
    {
        Stage = stage;
        LastActivityAt = DateOnly.FromDateTime(DateTime.UtcNow);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
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
