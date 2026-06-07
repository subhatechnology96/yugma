using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Referrals;

public enum ReferralStatus { New, InReview, Interviewing, Hired, NotSelected }

/// <summary>An employee referral — a staff member recommends a candidate for an open role, tracked to a reward.</summary>
public sealed class EmployeeReferral : Entity<Guid>, IAggregateRoot
{
    public string Referrer { get; private set; } = default!;          // referring employee
    public string CandidateName { get; private set; } = default!;
    public string? CandidateEmail { get; private set; }
    public string Position { get; private set; } = default!;
    public string? Department { get; private set; }
    public ReferralStatus Status { get; private set; }
    public DateOnly ReferredAt { get; private set; }
    public decimal BonusAmount { get; private set; }
    public bool BonusPaid { get; private set; }
    public string? Notes { get; private set; }

    private EmployeeReferral() { } // EF

    public static EmployeeReferral Create(Guid tenantId, string referrer, string candidateName, string position,
        string? candidateEmail = null, string? department = null, ReferralStatus status = ReferralStatus.New,
        DateOnly? referredAt = null, decimal bonusAmount = 0, string? notes = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(referrer)) throw new ArgumentException("Referrer is required.", nameof(referrer));
        if (string.IsNullOrWhiteSpace(candidateName)) throw new ArgumentException("Candidate name is required.", nameof(candidateName));
        return new EmployeeReferral
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Referrer = referrer.Trim(),
            CandidateName = candidateName.Trim(),
            CandidateEmail = string.IsNullOrWhiteSpace(candidateEmail) ? null : candidateEmail.Trim(),
            Position = string.IsNullOrWhiteSpace(position) ? "—" : position.Trim(),
            Department = string.IsNullOrWhiteSpace(department) ? null : department.Trim(),
            Status = status,
            ReferredAt = referredAt ?? DateOnly.FromDateTime(DateTime.UtcNow),
            BonusAmount = bonusAmount < 0 ? 0 : bonusAmount,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void MoveTo(ReferralStatus status, string? by) { Status = status; Touch(by); }
    public void MarkBonusPaid(string? by) { BonusPaid = true; Touch(by); }
    public void SetBonus(decimal amount, string? by) { BonusAmount = amount < 0 ? 0 : amount; Touch(by); }

    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
