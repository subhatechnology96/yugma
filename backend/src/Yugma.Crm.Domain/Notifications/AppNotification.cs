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

    public static AppNotification Create(Guid tenantId, string title, string message, NotificationKind kind, DateTime createdAt, bool read, string? link = null)
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
            CreatedAt = DateTime.UtcNow
        };
}
