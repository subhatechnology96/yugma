using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.SupplyChain;

public enum QualityStatus { ToDo, Pass, Fail }
public enum QualityCheckType { PassFail, Measure, Instructions }

/// <summary>A quality control check on a product / operation.</summary>
public sealed class QualityCheck : Entity<Guid>, IAggregateRoot
{
    public string Reference { get; private set; } = default!;
    public string Title { get; private set; } = default!;
    public string Product { get; private set; } = default!;
    public QualityCheckType CheckType { get; private set; }
    public QualityStatus Status { get; private set; }
    public string ControlPoint { get; private set; } = default!;
    public string? SourceDocument { get; private set; }
    public string? Responsible { get; private set; }
    public string? Measure { get; private set; }
    public string? Notes { get; private set; }

    private QualityCheck() { }

    public static QualityCheck Create(Guid tenantId, string reference, string title, string product, QualityCheckType type,
        string controlPoint, QualityStatus status = QualityStatus.ToDo, string? sourceDocument = null,
        string? responsible = null, string? measure = null, string? notes = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        return new QualityCheck
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Reference = reference.Trim(),
            Title = title.Trim(),
            Product = string.IsNullOrWhiteSpace(product) ? "—" : product.Trim(),
            CheckType = type,
            Status = status,
            ControlPoint = string.IsNullOrWhiteSpace(controlPoint) ? "Receipt" : controlPoint.Trim(),
            SourceDocument = string.IsNullOrWhiteSpace(sourceDocument) ? null : sourceDocument.Trim(),
            Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim(),
            Measure = string.IsNullOrWhiteSpace(measure) ? null : measure.Trim(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void SetResult(QualityStatus status, string? notes, string? by)
    {
        Status = status;
        if (!string.IsNullOrWhiteSpace(notes)) Notes = notes.Trim();
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }

    public void Update(string title, string product, QualityCheckType type, string controlPoint, string? sourceDocument, string? responsible, string? measure, string? notes, string? by)
    {
        if (!string.IsNullOrWhiteSpace(title)) Title = title.Trim();
        Product = string.IsNullOrWhiteSpace(product) ? "—" : product.Trim();
        CheckType = type;
        ControlPoint = string.IsNullOrWhiteSpace(controlPoint) ? "Receipt" : controlPoint.Trim();
        SourceDocument = string.IsNullOrWhiteSpace(sourceDocument) ? null : sourceDocument.Trim();
        Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim();
        Measure = string.IsNullOrWhiteSpace(measure) ? null : measure.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}
