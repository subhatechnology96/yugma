namespace Yugma.Crm.Domain.Agents;

public sealed record AgentInvocation(string AgentKey, string Stage, string AgentName, string Model, string? Input);

public sealed record AgentResult(string Output, string Summary, int TokensIn, int TokensOut, int LatencyMs);

/// <summary>
/// Lets an executor recursively invoke other agents. Implementations track parent/child
/// relationships, enforce a max depth, and prevent cycles.
/// </summary>
public interface IAgentRuntime
{
    /// <summary>The maximum allowed recursion depth from this runtime.</summary>
    int MaxDepth { get; }

    /// <summary>Invoke another agent as a child of the currently-running one.</summary>
    Task<AgentResult> CallAgentAsync(string agentKey, string? input, CancellationToken ct);
}

/// <summary>Pluggable strategy that executes an agent. Mock today, OpenAI/Anthropic tomorrow.</summary>
public interface IAgentExecutor
{
    Task<AgentResult> RunAsync(AgentInvocation invocation, IAgentRuntime runtime, CancellationToken ct);
}
