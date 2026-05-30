using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Agents;

/// <summary>Catalogue entry for an HR-lifecycle AI agent. Seeded; not user-editable.</summary>
public sealed class HrAgent : Entity<Guid>, IAggregateRoot
{
    public string Key { get; set; } = default!;          // e.g. "recruitment.jd_generator"
    public string Stage { get; set; } = default!;        // recruitment | offer | onboarding | confirmation | active | separation | exit | alumni
    public string Name { get; set; } = default!;
    public string Tagline { get; set; } = default!;
    public string Description { get; set; } = default!;
    public string Icon { get; set; } = default!;
    public string Model { get; set; } = "gpt-5";         // headline model used
    public string Capability { get; set; } = default!;   // short, e.g. "Drafting", "Ranking", "Forecasting"
    public bool Enabled { get; set; } = true;

    public static HrAgent Create(
        Guid tenantId, string key, string stage, string name, string tagline,
        string description, string icon, string model, string capability)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Key = key,
            Stage = stage,
            Name = name,
            Tagline = tagline,
            Description = description,
            Icon = icon,
            Model = model,
            Capability = capability,
            Enabled = true,
            CreatedAt = DateTime.UtcNow
        };
}
