using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Documents;

public enum DocumentStatus { Verified, Pending, Expired }

/// <summary>
/// A file attached to an employee profile (offer letter, ID proof, Form 16, certificates, …).
/// Only metadata is stored here; the binary would live in object storage in production.
/// </summary>
public sealed class EmployeeDocument : Entity<Guid>, IAggregateRoot
{
    public Guid EmployeeId { get; private set; }
    public string Name { get; private set; } = default!;
    public string Category { get; private set; } = default!;
    public string FileType { get; private set; } = default!;
    public long SizeBytes { get; private set; }
    public DocumentStatus Status { get; private set; }
    public DateOnly UploadedAt { get; private set; }
    public DateOnly? ExpiresAt { get; private set; }
    public string? UploadedBy { get; private set; }

    private EmployeeDocument() { } // EF

    public static EmployeeDocument Create(
        Guid tenantId,
        Guid employeeId,
        string name,
        string category,
        string fileType,
        long sizeBytes,
        DocumentStatus status,
        DateOnly uploadedAt,
        DateOnly? expiresAt = null,
        string? uploadedBy = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeId = employeeId,
            Name = name.Trim(),
            Category = category.Trim(),
            FileType = fileType.Trim(),
            SizeBytes = sizeBytes,
            Status = status,
            UploadedAt = uploadedAt,
            ExpiresAt = expiresAt,
            UploadedBy = uploadedBy,
            CreatedAt = DateTime.UtcNow
        };
}
