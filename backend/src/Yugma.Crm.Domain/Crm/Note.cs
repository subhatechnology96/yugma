using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Crm;

public sealed class Note : Entity<Guid>, IAggregateRoot
{
    public string Body { get; private set; } = default!;
    public CrmEntityType RelatedToType { get; private set; }
    public Guid RelatedToId { get; private set; }
    public string Author { get; private set; } = default!;

    private Note() { } // EF

    public static Note Create(
        Guid tenantId,
        string body,
        CrmEntityType relatedToType,
        Guid relatedToId,
        string author,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(body))
            throw new ArgumentException("Note body is required.", nameof(body));
        if (string.IsNullOrWhiteSpace(author))
            throw new ArgumentException("Author is required.", nameof(author));

        return new Note
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Body = body.Trim(),
            RelatedToType = relatedToType,
            RelatedToId = relatedToId,
            Author = author.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Edit(string body, string? updatedBy)
    {
        Body = body.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}
