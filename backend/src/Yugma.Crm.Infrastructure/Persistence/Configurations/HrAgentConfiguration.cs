using Yugma.Crm.Domain.Agents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class HrAgentConfiguration : IEntityTypeConfiguration<HrAgent>
{
    public void Configure(EntityTypeBuilder<HrAgent> b)
    {
        b.ToTable("hr_agents");
        b.HasKey(e => e.Id);
        b.Property(e => e.Key).HasMaxLength(80).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Key }).IsUnique();
        b.Property(e => e.Stage).HasMaxLength(30).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.Name).HasMaxLength(120).IsRequired();
        b.Property(e => e.Tagline).HasMaxLength(180).IsRequired();
        b.Property(e => e.Description).HasMaxLength(800).IsRequired();
        b.Property(e => e.Icon).HasMaxLength(40).IsRequired();
        b.Property(e => e.Model).HasMaxLength(40).IsRequired();
        b.Property(e => e.Capability).HasMaxLength(40).IsRequired();
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}

internal sealed class HrAgentRunConfiguration : IEntityTypeConfiguration<HrAgentRun>
{
    public void Configure(EntityTypeBuilder<HrAgentRun> b)
    {
        b.ToTable("hr_agent_runs");
        b.HasKey(e => e.Id);
        b.Property(e => e.AgentKey).HasMaxLength(80).IsRequired();
        b.HasIndex(e => new { e.TenantId, e.AgentKey, e.StartedAtUtc });
        b.HasIndex(e => new { e.TenantId, e.StartedAtUtc });
        b.Property(e => e.AgentName).HasMaxLength(120).IsRequired();
        b.Property(e => e.Stage).HasMaxLength(30).IsRequired();
        b.Property(e => e.Model).HasMaxLength(40).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.Input).HasColumnType("text");
        b.Property(e => e.Output).HasColumnType("text");
        b.Property(e => e.Summary).HasMaxLength(400);
        b.Property(e => e.TriggeredBy).HasMaxLength(120);
        b.Property(e => e.ParentRunId);
        b.HasIndex(e => e.ParentRunId);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
