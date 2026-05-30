using System.Diagnostics;
using Yugma.Crm.Domain.Agents;
using Microsoft.Extensions.Logging;

namespace Yugma.Crm.Infrastructure.Agents;

/// <summary>
/// Mock GPT-5 executor — deterministic by agent key, returns realistic outputs so the UI
/// looks/feels alive without spending API budget. Swap with <c>OpenAiAgentExecutor</c> for prod.
/// </summary>
internal sealed class MockAgentExecutor(ILogger<MockAgentExecutor> logger) : IAgentExecutor
{
    public async Task<AgentResult> RunAsync(AgentInvocation invocation, IAgentRuntime runtime, CancellationToken ct)
    {
        // Orchestrators call other agents and compose the result.
        if (IsOrchestrator(invocation.AgentKey))
            return await RunOrchestratorAsync(invocation, runtime, ct);

        var sw = Stopwatch.StartNew();
        // simulate model latency
        await Task.Delay(Random.Shared.Next(450, 1500), ct);

        var (output, summary) = invocation.AgentKey switch
        {
            "recruitment.jd_generator" => (JdGenerator(invocation.Input), "Drafted a 480-word JD with 6 must-haves and 4 nice-to-haves."),
            "recruitment.resume_ranker" => (ResumeRanker(),               "Ranked 124 resumes; top 8 surfaced with rationales."),
            "recruitment.screening_bot" => (ScreeningBot(),               "Auto-screened 32 inbound applicants; 11 advanced."),
            "offer.salary_benchmark"    => (SalaryBenchmark(),            "Benchmark range ₹28-42L · p50 ₹34L for Bengaluru SDE-3."),
            "offer.accept_prediction"   => (AcceptPrediction(),           "Acceptance likelihood 78% · suggested ESOP bump +0.05%."),
            "offer.bgv_summary"         => (BgvSummary(),                 "Background check clean — 0 red flags, 1 minor note."),
            "onboarding.doc_extract"    => (DocExtract(),                 "Extracted 14 fields from Aadhaar + PAN + offer letter."),
            "onboarding.plan"           => (OnboardingPlan(),             "30-60-90 plan with 12 milestones across 4 tracks."),
            "onboarding.buddy_match"    => (BuddyMatch(),                 "Best buddy match: Ananya Rao (94% interest overlap)."),
            "confirmation.probation"    => (ProbationScore(),             "Probation score 4.3/5 — confirmation recommended."),
            "confirmation.feedback"     => (FeedbackSynth(),              "Synthesised 8 manager + peer notes into 1-page review."),
            "active.attendance"         => (AttendanceAnomaly(),          "Detected 3 anomalies: 1 missed punch-out, 2 long lunches."),
            "active.payroll"            => (PayrollAnomaly(),             "Payroll variance check: 2 outliers (>₹5k delta MoM)."),
            "active.performance"        => (PerformanceGoals(),           "Drafted 5 SMART goals aligned to Q3 OKRs."),
            "active.learning"           => (LearningPaths(),              "Identified 3 skill gaps · recommended 7 courses."),
            "active.copilot"            => (Copilot(invocation.Input),    "Answered policy Q with cite from leave-policy v3.2."),
            "active.engagement"         => (Engagement(),                 "Pulse score 7.4 ▲ · 4 burnout signals on Eng team."),
            "separation.attrition"      => (Attrition(),                  "High-risk attrition: 4 employees · top driver: comp gap."),
            "separation.retention"      => (Retention(),                  "Suggested 3 retention nudges: stretch role, bump, sabbatical."),
            "separation.exit_clusters"  => (ExitClusters(),               "Top exit theme: 'manager mismatch' (38% of Q2 exits)."),
            "exit.handover"             => (Handover(),                   "Generated 6-page handover doc from Jira + Confluence + Slack."),
            "exit.ff"                   => (FfValidation(),               "F&F validated — net dues ₹1.24L; 0 anomalies."),
            "exit.interview"            => (ExitInterview(),              "Synthesised exit interview into 5 themes + verbatims."),
            "alumni.rehire"             => (RehireScoring(),              "Rehire score 8.6/10 — strong candidate for re-entry."),
            "alumni.boomerang"          => (Boomerang(),                  "Boomerang likelihood 41% within 18 months."),
            "alumni.network"            => (AlumniNetwork(),              "127 alumni mapped to 6 companies · 14 warm intros."),
            _                            => ($"# {invocation.AgentName}\n\nMock output from {invocation.Model}.\n\n_(Plug in a real model in `IAgentExecutor`.)_", "Mock run.")
        };

        sw.Stop();
        var tokensIn = (invocation.Input ?? string.Empty).Length / 4 + 80;
        var tokensOut = output.Length / 4;
        logger.LogInformation("Agent {AgentKey} ran in {Ms}ms (in={In}, out={Out})", invocation.AgentKey, sw.ElapsedMilliseconds, tokensIn, tokensOut);
        return new AgentResult(output, summary, tokensIn, tokensOut, (int)sw.ElapsedMilliseconds);
    }

    // --- fixture outputs (kept brief; UI renders markdown) ----------------------------------

    private static string JdGenerator(string? input) => $@"# Senior Engineer — Yugma Platform
**Location**: Bengaluru / Hybrid · **Team**: Platform · **Reports to**: Engineering Director

## What you'll do
- Own the multi-tenant ingestion pipeline (Postgres + Kafka).
- Lead a squad of 3 engineers shipping bi-weekly to enterprise tenants.
- Partner with PM/Design on the Yugma Copilot surface.

## Must have
- 6+ yrs production .NET (or equivalent) with strong distributed-systems fundamentals.
- Postgres at scale (>50M rows), partitioning, JSONB, query plans.
- Experience integrating LLM agents into transactional workflows.

## Nice to have
- Angular 21 / Signals · OpenTelemetry · gRPC streaming
- Prior CRM/HRMS exposure

_Drafted by Yugma JD agent · gpt-5 · {DateTime.UtcNow:yyyy-MM-dd}_";

    private static string ResumeRanker() => @"## Top 8 of 124 resumes

| # | Candidate            | Fit | Why                                                         |
|---|----------------------|-----|-------------------------------------------------------------|
| 1 | Aditi Menon          | 96% | 7y .NET + Postgres at scale · 2 OSS PRs on Npgsql           |
| 2 | Ishaan Kapoor        | 91% | LLM eval pipelines at prior co · strong systems fundamentals |
| 3 | Riya Saxena          | 89% | Ex-Razorpay platform · payments + idempotency               |
| 4 | Manav Bhardwaj       | 86% | Distributed Kafka pipelines · weak on Postgres internals    |
| 5 | Pooja Reddy          | 83% | Strong on Angular/TS; would be a stretch for backend        |
| 6 | Arjun Trivedi        | 78% | Solid generalist; lacks LLM exposure                        |
| 7 | Neha Banerjee        | 76% | Hackathon hire; less prod experience                        |
| 8 | Karthik Rao          | 72% | Right energy; needs ramp                                    |

_Outliers flagged for the recruiter. Bias check: gender ratio of top-20 = 47/53._";

    private static string ScreeningBot() => "Screened 32 applicants. 11 advanced to recruiter review based on must-haves match >0.8. Sent personalised polite rejections to 18.";

    private static string SalaryBenchmark() => @"### Market range — SDE-3 / Bengaluru / Platform
- p25 ₹28L · **p50 ₹34L** · p75 ₹41L · p90 ₹48L
- Sources: Mercer 2026 H1, AON, Levels.fyi (12-month rolling, hybrid roles only)

### Recommendation
Offer at **p60 ≈ ₹37L** + ESOP 0.15% (4y/1y cliff). Accept-likelihood at this band rises from 64% → 81%.";

    private static string AcceptPrediction() => "Accept-likelihood **78%**. Top drivers: comp at p60 (+9pp), manager 1:1 within 48h (+6pp), remote-friendly clause (+4pp). Risk: candidate also interviewing at Razorpay.";

    private static string BgvSummary() => "Background check: education + last 2 employers verified. 1 minor note: gap of 4 months in 2023 — confirmed sabbatical. **Clean.**";

    private static string DocExtract() => "Extracted 14 fields from Aadhaar + PAN + offer letter. Confidence ≥0.96 on all. Auto-filled employee profile and tax declaration form.";

    private static string OnboardingPlan() => @"## 30-60-90 day plan — Riya Saxena
**Day 1-7** · Laptop, AD account, swag · 6 intro coffees · platform code tour · ship trivial PR.
**Day 8-30** · Own 1 medium bug · attend 3 customer calls · complete security + compliance modules.
**Day 31-60** · Lead 1 feature spec · pair with on-call rotation · 1st 1:1 retro.
**Day 61-90** · Ship 1 feature solo · present at engg all-hands.

Buddy: **Ananya Rao** · Manager 1:1 every Tuesday 4pm.";

    private static string BuddyMatch() => "Best match: **Ananya Rao** (Senior Engineer, Bengaluru). Overlap: TypeScript + Postgres + climbing. Calendar conflict score 0.12 (low).";

    private static string ProbationScore() => "Probation score **4.3/5** across delivery (4.5), collaboration (4.4), culture-add (4.0). **Recommendation: confirm.** 2 development areas: spec writing, async comms.";

    private static string FeedbackSynth() => "Synthesised 5 manager + 3 peer notes:\n\n- **Strengths**: delivery velocity, deep ownership, willingness to mentor.\n- **Watch**: tends to over-engineer, slow on doc updates.\n- **Action**: pair with Tanvi on next spec.";

    private static string AttendanceAnomaly() => "Detected 3 anomalies last week:\n- Karthik Nair — missed punch-out Tue 14 May (auto-corrected via badge data)\n- Sneha Iyer — 2 long lunches >90min (consistent pattern)\n- Devansh Patel — login from a new IP at 03:14 (flagged to security)";

    private static string PayrollAnomaly() => "2 outliers MoM:\n- E#YUG-1004 — variable pay +₹7,200 (sales incentive, expected)\n- E#YUG-1009 — overtime +₹6,800 (above 80th percentile, investigate)";

    private static string PerformanceGoals() => "Drafted 5 SMART goals aligned to Q3 OKRs:\n1. Ship Yugma Copilot v2 to 3 enterprise tenants by Sept-30.\n2. Reduce p95 dashboard load to <1.2s.\n3. Mentor 1 junior engineer through promo cycle.\n4. Drive an architecture RFC on Kafka adoption.\n5. Complete the Platform L4 → L5 calibration kit.";

    private static string LearningPaths() => "Top 3 skill gaps in your team: vector databases, OpenTelemetry, advanced Postgres. Suggested paths: 7 courses, 2 internal workshops, 1 hands-on lab. Time investment: ~14h/engineer.";

    private static string Copilot(string? input) => $"You asked: _{input ?? "How many sick leaves can I carry forward?"}_\n\n> Up to **5 sick leaves** can carry forward each cycle, capped at 15 total. Anything beyond lapses on Apr-1. (Source: Leave policy v3.2, §4.b)";

    private static string Engagement() => "Pulse: **7.4 / 10** (▲ 0.3 WoW). Burnout signals on Engineering — 4 employees with >55h average + low pulse responses. Suggested: skip-level 1:1s within 7 days.";

    private static string Attrition() => "**4 employees** at high attrition risk (>0.7):\n- Comp gap vs market (top driver, 3/4 cases)\n- Manager-change friction (2/4)\n- Stagnant L-band for >18 months (3/4)\n\nAuto-drafted retention plans queued for HRBP review.";

    private static string Retention() => "Suggested nudges:\n1. **Stretch role** — lead the Copilot v2 launch (Karthik)\n2. **Mid-cycle bump** — close p50 gap (Aisha)\n3. **Sabbatical option** — open 3-month sabbatical (Vikram)";

    private static string ExitClusters() => "Q2 exit themes (sentence-embedding clusters of 14 interviews):\n- **Manager mismatch** — 38%\n- **Comp** — 24%\n- **Growth ceiling** — 19%\n- **Personal / relocation** — 14%\n- **Culture** — 5%";

    private static string Handover() => "Generated 6-page handover doc:\n- 14 owned services with on-call notes\n- 7 in-flight tickets with status + next-best-action\n- 3 architecture diagrams pulled from Confluence\n- Contact list of 12 stakeholders\n\nReviewers: manager + buddy.";

    private static string FfValidation() => "Full & Final settlement validated:\n- Earned salary: ₹1,02,400\n- Leave encashment: ₹18,200\n- Notice period adj: +₹4,000\n- **Net dues**: **₹1,24,600** · 0 anomalies · ready for HRBP approval.";

    private static string ExitInterview() => "Synthesised exit interview (45-min transcript → 1 page):\n- **Top themes**: comp gap, manager unclear on priorities, lack of L+1 growth path.\n- **Verbatims**: 'I loved the team but had to chase priorities every sprint.'\n- **Action**: roll up into Eng quarterly retro.";

    private static string RehireScoring() => "Rehire score **8.6/10**. Strong delivery history (4.7 perf), positive exit, alumni community contributor. Caveat: prior comp band needs re-benchmarking before re-offer.";

    private static string Boomerang() => "Boomerang likelihood **41%** within 18 months — model factored: positive exit sentiment, comp delta closing, ongoing alumni engagement (3 posts in last 90d).";

    private static string AlumniNetwork() => "Mapped **127 alumni** across 6 companies (Razorpay 22, Stripe 18, Atlassian 14…). Identified 14 warm intro paths for current biz-dev pipeline.";

    // ============== Orchestration ==============

    private static bool IsOrchestrator(string key) => key switch
    {
        "recruitment.pipeline"      => true,
        "onboarding.orchestrator"   => true,
        "confirmation.decision"     => true,
        "separation.action_plan"    => true,
        _ => false
    };

    private async Task<AgentResult> RunOrchestratorAsync(AgentInvocation invocation, IAgentRuntime runtime, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        await Task.Delay(Random.Shared.Next(250, 650), ct); // brief planning step

        var (steps, finalOutput, summary) = invocation.AgentKey switch
        {
            "recruitment.pipeline"    => await RunRecruitmentPipeline(runtime, invocation.Input, ct),
            "onboarding.orchestrator" => await RunOnboardingOrchestrator(runtime, invocation.Input, ct),
            "confirmation.decision"   => await RunConfirmationDecision(runtime, invocation.Input, ct),
            "separation.action_plan"  => await RunSeparationActionPlan(runtime, invocation.Input, ct),
            _                          => throw new InvalidOperationException("Unknown orchestrator " + invocation.AgentKey)
        };

        sw.Stop();
        var output = ComposeOrchestratorOutput(invocation.AgentName, steps, finalOutput);
        var tokensIn  = (invocation.Input ?? string.Empty).Length / 4 + 120;
        var tokensOut = output.Length / 4;
        logger.LogInformation("Orchestrator {AgentKey} completed {Steps} steps in {Ms}ms", invocation.AgentKey, steps.Count, sw.ElapsedMilliseconds);
        return new AgentResult(output, summary, tokensIn, tokensOut, (int)sw.ElapsedMilliseconds);
    }

    private static async Task<(List<OrchStep> steps, string final, string summary)> RunRecruitmentPipeline(IAgentRuntime rt, string? input, CancellationToken ct)
    {
        var steps = new List<OrchStep>();
        var jd = await rt.CallAgentAsync("recruitment.jd_generator", input ?? "Senior Engineer · Bengaluru · Postgres + .NET", ct);
        steps.Add(new("JD generated", "recruitment.jd_generator", jd.Summary));

        var rank = await rt.CallAgentAsync("recruitment.resume_ranker", "Using the JD above, rank the 124 inbound resumes.", ct);
        steps.Add(new("Resumes ranked", "recruitment.resume_ranker", rank.Summary));

        var screen = await rt.CallAgentAsync("recruitment.screening_bot", "Auto-screen the top 32 with a 6-question pre-screen.", ct);
        steps.Add(new("Pre-screen complete", "recruitment.screening_bot", screen.Summary));

        var final = $"Recruitment pipeline executed. Top 8 shortlist below.\n\n{rank.Output}";
        return (steps, final, "Drafted JD, ranked 124 resumes, screened 32 — 8 shortlisted.");
    }

    private static async Task<(List<OrchStep> steps, string final, string summary)> RunOnboardingOrchestrator(IAgentRuntime rt, string? input, CancellationToken ct)
    {
        var steps = new List<OrchStep>();
        var docs = await rt.CallAgentAsync("onboarding.doc_extract", input ?? "Aadhaar + PAN + offer letter for new hire.", ct);
        steps.Add(new("Documents extracted", "onboarding.doc_extract", docs.Summary));

        var plan = await rt.CallAgentAsync("onboarding.plan", "Generate a 30-60-90 plan for the new hire's role.", ct);
        steps.Add(new("30-60-90 plan drafted", "onboarding.plan", plan.Summary));

        var buddy = await rt.CallAgentAsync("onboarding.buddy_match", "Best onboarding buddy in the team.", ct);
        steps.Add(new("Buddy matched", "onboarding.buddy_match", buddy.Summary));

        var final = $"Onboarding kit prepared.\n\n{plan.Output}\n\n---\n\n{buddy.Output}";
        return (steps, final, "Extracted docs, generated 30-60-90 plan, matched onboarding buddy.");
    }

    private static async Task<(List<OrchStep> steps, string final, string summary)> RunConfirmationDecision(IAgentRuntime rt, string? input, CancellationToken ct)
    {
        var steps = new List<OrchStep>();
        var feedback = await rt.CallAgentAsync("confirmation.feedback", input ?? "Synthesise feedback for probation review.", ct);
        steps.Add(new("Feedback synthesised", "confirmation.feedback", feedback.Summary));

        var score = await rt.CallAgentAsync("confirmation.probation", "Score probation using the synthesised feedback.", ct);
        steps.Add(new("Probation scored", "confirmation.probation", score.Summary));

        var final = $"## Feedback synthesis\n{feedback.Output}\n\n## Probation score\n{score.Output}";
        return (steps, final, "Synthesised feedback, scored probation — confirmation recommended.");
    }

    private static async Task<(List<OrchStep> steps, string final, string summary)> RunSeparationActionPlan(IAgentRuntime rt, string? input, CancellationToken ct)
    {
        var steps = new List<OrchStep>();
        var risk = await rt.CallAgentAsync("separation.attrition", input ?? "Identify employees at attrition risk.", ct);
        steps.Add(new("Attrition risk computed", "separation.attrition", risk.Summary));

        var plan = await rt.CallAgentAsync("separation.retention", "For each at-risk employee, propose retention nudges.", ct);
        steps.Add(new("Retention plan drafted", "separation.retention", plan.Summary));

        var final = $"## Risk\n{risk.Output}\n\n## Recommended nudges\n{plan.Output}";
        return (steps, final, "Identified 4 high-risk employees and drafted 3 retention nudges.");
    }

    private sealed record OrchStep(string Label, string AgentKey, string Summary);

    private static string ComposeOrchestratorOutput(string orchestratorName, List<OrchStep> steps, string finalText)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"# {orchestratorName} · run trace");
        for (var i = 0; i < steps.Count; i++)
        {
            var s = steps[i];
            sb.AppendLine($"{i + 1}. **{s.Label}** — _{s.AgentKey}_  ");
            sb.AppendLine($"   > {s.Summary}");
        }
        sb.AppendLine();
        sb.AppendLine("---");
        sb.AppendLine();
        sb.AppendLine(finalText);
        return sb.ToString();
    }
}
