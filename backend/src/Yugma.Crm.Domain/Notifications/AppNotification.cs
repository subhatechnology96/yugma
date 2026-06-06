using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Notifications;

public enum NotificationKind { Info, Success, Warn, Danger }

public sealed class AppNotification : Entity<Guid>, IAggregateRoot
{
    public string Title { get; set; } = default!;
    public string Message { get; set; } = default!;
    public NotificationKind Kind { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
    public string? Link { get; set; }

    /// <summary>When set, only the user with this email sees the notification (personal). Null = role-targeted via <see cref="Audience"/>.</summary>
    public string? RecipientEmail { get; set; }

    /// <summary>Coarse role audience when there is no specific recipient: "all" (or null = everyone), "hrManage" (HR/managers), or "admin".</summary>
    public string? Audience { get; set; }

    public static AppNotification Create(Guid tenantId, string title, string message, NotificationKind kind, DateTime createdAt, bool read, string? link = null, string? recipientEmail = null, string? audience = null)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Title = title,
            Message = message,
            Kind = kind,
            CreatedAtUtc = createdAt,
            ReadAtUtc = read ? createdAt.AddMinutes(1) : null,
            Link = link,
            RecipientEmail = recipientEmail,
            Audience = audience,
            CreatedAt = DateTime.UtcNow
        };
}
