using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Finance;

public enum SignatureStatus { None, Pending, Signed }

/// <summary>A finance document on file (Documents app) that may also be routed for e-signature (Sign app).</summary>
public sealed class FinanceFile : Entity<Guid>, IAggregateRoot
{
    public string Name { get; private set; } = default!;
    public string Category { get; private set; } = default!;          // Invoice | Contract | Statement | Report | Tax
    public string Owner { get; private set; } = default!;
    public SignatureStatus SignatureStatus { get; private set; }
    public string? Signer { get; private set; }
    public DateTime? SignedAt { get; private set; }

    private FinanceFile() { } // EF

    public static FinanceFile Create(Guid tenantId, string name, string category, string owner,
        SignatureStatus signatureStatus = SignatureStatus.None, string? signer = null, DateTime? signedAt = null, string? createdBy = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Category = string.IsNullOrWhiteSpace(category) ? "Document" : category.Trim(),
            Owner = owner.Trim(),
            SignatureStatus = signatureStatus,
            Signer = string.IsNullOrWhiteSpace(signer) ? null : signer.Trim(),
            SignedAt = signedAt,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };

    public void RequestSignature(string signer, string? by)
    {
        Signer = signer.Trim();
        SignatureStatus = SignatureStatus.Pending;
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }

    public void MarkSigned(string? by)
    {
        SignatureStatus = SignatureStatus.Signed;
        SignedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}
