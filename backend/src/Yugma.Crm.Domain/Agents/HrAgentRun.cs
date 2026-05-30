using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Agents;

public sealed class HrAgentRun : Entity<Guid>, IAggregateRoot
{
    public string AgentKey { get; set; } = default!;
    public string AgentName { get; set; } = default!;
    public string Stage { get; set; } = default!;
    public string Model { get; set; } = default!;
    /// <summary>pending | running | succeeded | failed</summary>
    public string Status { get; set; } = "pending";
    public string? Input { get; set; }    // JSON
    public string? Output { get; set; }   // JSON or markdown
    public string? Summary { get; set; }  // short, one-line "what it did"
    public int TokensIn { get; set; }
    public int TokensOut { get; set; }
    public int LatencyMs { get; set; }
    public string? TriggeredBy { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    /// <summary>When set, this run was invoked by another agent as part of an orchestration.</summary>
    public Guid? ParentRunId { get; set; }
    /// <summary>How deep this run sits in the orchestration tree (0 = top-level).</summary>
    public int Depth { get; set; }

    public static HrAgentRun Start(
        Guid tenantId, string agentKey, string agentName, string stage, string model,
        string? input, string? triggeredBy,
        Guid? parentRunId = null, int depth = 0)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AgentKey = agentKey,
            AgentName = agentName,
            Stage = stage,
            Model = model,
            Status = "running",
            Input = input,
            TriggeredBy = triggeredBy,
            ParentRunId = parentRunId,
            Depth = depth,
            StartedAtUtc = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

    public void Complete(string output, string summary, int tokensIn, int tokensOut, int latencyMs)
    {
        Status = "succeeded";
        Output = output;
        Summary = summary;
        TokensIn = tokensIn;
        TokensOut = tokensOut;
        LatencyMs = latencyMs;
        CompletedAtUtc = DateTime.UtcNow;
    }
}
