using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Career;

/// <summary>
/// A project an employee tracks in their professional history. User-entered projects are persisted
/// here and merged with the generated career history on read.
/// </summary>
public sealed class EmployeeProject : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public string Name { get; private set; } = default!;
    public string Domain { get; private set; } = default!;
    public string Role { get; private set; } = default!;
    public string? Manager { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public string Status { get; private set; } = default!;       // Completed | Ongoing | On hold
    public int Rating { get; private set; }
    public string? Responsibilities { get; private set; }        // newline-separated
    public string? Outcome { get; private set; }
    public string? Feedback { get; private set; }
    public string? Skills { get; private set; }                  // comma-separated
    public int TeamSize { get; private set; }

    private EmployeeProject() { } // EF

    public static EmployeeProject Create(Guid tenantId, Guid employeeId, string name, string domain, string role, string? manager,
        DateOnly startDate, DateOnly? endDate, string status, int rating, string? responsibilities, string? outcome, string? feedback, string? skills, int teamSize, string? by)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Name = name.Trim(),
            Domain = domain.Trim(),
            Role = role.Trim(),
            Manager = manager?.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            Status = status,
            Rating = Math.Clamp(rating, 1, 5),
            Responsibilities = responsibilities,
            Outcome = outcome,
            Feedback = feedback,
            Skills = skills,
            TeamSize = teamSize,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = by
        };

    public void Update(string name, string domain, string role, string? manager, DateOnly startDate, DateOnly? endDate,
        string status, int rating, string? responsibilities, string? outcome, string? feedback, string? skills, int teamSize, string? by)
    {
        Name = name.Trim();
        Domain = domain.Trim();
        Role = role.Trim();
        Manager = manager?.Trim();
        StartDate = startDate;
        EndDate = endDate;
        Status = status;
        Rating = Math.Clamp(rating, 1, 5);
        Responsibilities = responsibilities;
        Outcome = outcome;
        Feedback = feedback;
        Skills = skills;
        TeamSize = teamSize;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
