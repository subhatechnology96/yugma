using Yugma.Crm.Domain.Common;
using Yugma.Crm.Domain.Hr.Events;
using Yugma.Crm.Domain.Hr.ValueObjects;

namespace Yugma.Crm.Domain.Hr;

public enum EmployeeStatus { Active, OnLeave, Inactive }
public enum EmploymentType { FullTime, PartTime, Contract, Intern }

public sealed class Employee : Entity<Guid>, IAggregateRoot
{
    public string Code { get; private set; } = default!;
    public PersonName Name { get; private set; } = default!;
    public Email Email { get; private set; } = default!;
    public PhoneNumber Phone { get; private set; } = default!;
    public string Department { get; private set; } = default!;
    public string Designation { get; private set; } = default!;
    public string Location { get; private set; } = default!;
    public string? Manager { get; private set; }
    /// <summary>Reporting manager's employee id. Authoritative for the org tree / reporting trail (the <see cref="Manager"/> string is kept in sync for legacy screens).</summary>
    public Guid? ManagerId { get; private set; }
    /// <summary>Hierarchy band 1..10 (L1 Trainee … L10 CEO). Null until assigned.</summary>
    public int? Band { get; private set; }
    public EmploymentType EmploymentType { get; private set; }
    public EmployeeStatus Status { get; private set; }
    public DateOnly JoinedAt { get; private set; }
    public decimal CtcLakhs { get; private set; }
    public byte Performance { get; private set; }
    public string? AvatarUrl { get; private set; }

    private readonly List<string> _skills = new();
    public IReadOnlyList<string> Skills => _skills.AsReadOnly();

    private Employee() { } // EF

    public static Employee Create(
        Guid tenantId,
        string code,
        PersonName name,
        Email email,
        PhoneNumber phone,
        string department,
        string designation,
        string location,
        EmploymentType employmentType,
        DateOnly joinedAt,
        decimal ctcLakhs,
        string? manager = null,
        IEnumerable<string>? skills = null,
        string? createdBy = null,
        string? avatarUrl = null)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Employee code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(department))
            throw new ArgumentException("Department is required.", nameof(department));
        if (string.IsNullOrWhiteSpace(designation))
            throw new ArgumentException("Designation is required.", nameof(designation));
        if (ctcLakhs < 0) throw new ArgumentException("CTC cannot be negative.", nameof(ctcLakhs));

        var emp = new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim(),
            Name = name,
            Email = email,
            Phone = phone,
            Department = department.Trim(),
            Designation = designation.Trim(),
            Location = location.Trim(),
            EmploymentType = employmentType,
            Status = EmployeeStatus.Active,
            JoinedAt = joinedAt,
            CtcLakhs = ctcLakhs,
            Performance = 3,
            Manager = manager?.Trim(),
            AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        if (skills is not null) emp._skills.AddRange(skills.Where(s => !string.IsNullOrWhiteSpace(s)));
        emp.Raise(new EmployeeCreated(emp.Id, emp.TenantId, emp.Code));
        return emp;
    }

    public void UpdateContact(Email email, PhoneNumber phone, string location, string? updatedBy)
    {
        Email = email;
        Phone = phone;
        Location = location.Trim();
        Touch(updatedBy);
    }

    public void Reassign(string department, string designation, string? manager, string? updatedBy)
    {
        Department = department.Trim();
        Designation = designation.Trim();
        Manager = manager?.Trim();
        Touch(updatedBy);
    }

    /// <summary>Sets the hierarchy band (1..10). Pass null to clear.</summary>
    public void SetBand(int? band, string? updatedBy)
    {
        if (band is < 1 or > 10)
            throw new ArgumentOutOfRangeException(nameof(band), "Band must be between 1 (Trainee) and 10 (CEO).");
        Band = band;
        Touch(updatedBy);
    }

    /// <summary>Sets the reporting manager by id, keeping the manager-name snapshot in sync.</summary>
    public void SetManager(Guid? managerId, string? managerName, string? updatedBy)
    {
        ManagerId = managerId;
        Manager = string.IsNullOrWhiteSpace(managerName) ? null : managerName.Trim();
        Touch(updatedBy);
    }

    public void SetAvatar(string? avatarUrl, string? updatedBy)
    {
        AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim();
        Touch(updatedBy);
    }

    public void SetStatus(EmployeeStatus status, string? updatedBy)
    {
        if (Status == status) return;
        Status = status;
        Touch(updatedBy);
        Raise(new EmployeeStatusChanged(Id, TenantId, status));
    }

    public void RecordPerformance(byte score, string? updatedBy)
    {
        if (score is < 1 or > 5)
            throw new ArgumentOutOfRangeException(nameof(score), "Score must be 1..5.");
        Performance = score;
        Touch(updatedBy);
    }

    public void ReplaceSkills(IEnumerable<string> skills)
    {
        _skills.Clear();
        _skills.AddRange(skills.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct(StringComparer.OrdinalIgnoreCase));
    }

    private void Touch(string? user)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = user;
    }
}
