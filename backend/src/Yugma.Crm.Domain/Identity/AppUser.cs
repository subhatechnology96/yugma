using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Identity;

public enum UserStatus { Active, Inactive, Pending, Suspended }

public sealed class AppUser : Entity<Guid>, IAggregateRoot
{
    public string FullName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string Role { get; set; } = default!;
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public bool MfaEnabled { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime? InvitedAt { get; set; }
    public UserStatus Status { get; set; }
    /// <summary>PBKDF2 password hash (see PasswordHasher). Null until a password is set.</summary>
    public string? PasswordHash { get; private set; }

    public static AppUser Create(Guid tenantId, string fullName, string email, string role, bool mfa, DateTime? lastLogin, UserStatus status)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FullName = fullName,
            Email = email,
            Role = role,
            MfaEnabled = mfa,
            LastLoginAt = lastLogin,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };

    /// <summary>Creates a freshly-invited user who has not yet accepted (status = Pending).</summary>
    public static AppUser Invite(Guid tenantId, string fullName, string email, string role, string? jobTitle, string? department, bool mfa, string? invitedBy)
    {
        var u = Create(tenantId, fullName, email, role, mfa, null, UserStatus.Pending);
        u.JobTitle = jobTitle;
        u.Department = department;
        u.InvitedAt = DateTime.UtcNow;
        u.CreatedBy = invitedBy;
        return u;
    }

    public void UpdateProfile(string fullName, string role, string? jobTitle, string? department, string? by)
    {
        FullName = fullName;
        Role = role;
        JobTitle = jobTitle;
        Department = department;
        Touch(by);
    }

    /// <summary>Stores a pre-computed password hash (hashing is done in the infrastructure layer).</summary>
    public void SetPasswordHash(string hash, string? by) { PasswordHash = hash; Touch(by); }
    public void RecordLogin() { LastLoginAt = DateTime.UtcNow; }

    public void ChangeRole(string role, string? by) { Role = role; Touch(by); }
    public void SetStatus(UserStatus status, string? by) { Status = status; Touch(by); }
    public void SetMfa(bool enabled, string? by) { MfaEnabled = enabled; Touch(by); }
    public void MarkInviteResent(string? by) { InvitedAt = DateTime.UtcNow; Touch(by); }

    private void Touch(string? by)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = by;
    }
}
