using Yugma.Crm.Domain.Hr.Recruiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Yugma.Crm.Infrastructure.Persistence.Configurations;

internal sealed class CandidateConfiguration : IEntityTypeConfiguration<Candidate>
{
    public void Configure(EntityTypeBuilder<Candidate> b)
    {
        b.ToTable("candidates");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Role).HasMaxLength(150).IsRequired();
        b.Property(e => e.Source).HasMaxLength(50).IsRequired();
        b.Property(e => e.Stage).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Email).HasMaxLength(256);
        b.Property(e => e.Location).HasMaxLength(100);
        b.Property(e => e.Owner).HasMaxLength(200);
        b.Property(e => e.ExpectedCtcLakhs).HasColumnType("numeric(10,2)");

        // ---- recruitment workflow ----
        b.Property(e => e.ResumeFileName).HasMaxLength(260);
        b.Property(e => e.ResumeUrl);                       // text: data URL or external link
        b.Property(e => e.Interviewer).HasMaxLength(200);
        b.Property(e => e.InterviewScheduledAt);
        // Interview verdicts and the workflow timeline are stored inline as JSON (jsonb) arrays.
        b.OwnsMany(e => e.Feedback, o => o.ToJson());
        b.OwnsMany(e => e.Activity, o => o.ToJson());

        // Post-hire onboarding is a single nested JSON document (jsonb).
        b.OwnsOne(e => e.Onboarding, o =>
        {
            o.ToJson();
            o.Property(x => x.Step).HasConversion<string>();
            o.OwnsMany(x => x.Documents);
        });

        b.HasIndex(e => new { e.TenantId, e.Stage });
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.Ignore(e => e.DomainEvents);
    }
}
