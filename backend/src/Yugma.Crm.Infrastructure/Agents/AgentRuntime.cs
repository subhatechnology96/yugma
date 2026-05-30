using Yugma.Crm.Domain.Agents;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Yugma.Crm.Infrastructure.Agents;

/// <summary>
/// Scoped per-request runtime that lets agents call other agents. Tracks the parent
/// chain (for tree reconstruction), enforces max depth, and prevents cycles.
/// </summary>
public sealed class AgentRuntime(
    YugmaDbContext db,
    IAgentExecutor executor,
    ILogger<AgentRuntime> logger) : IAgentRuntime
{
    public int MaxDepth => 3;

    private readonly Stack<(Guid RunId, string AgentKey)> _stack = new();
    private string? _triggeredBy;

    /// <summary>Top-level entry point — invoked once per HTTP request.</summary>
    public async Task<HrAgentRun> InvokeAsync(string agentKey, string? input, string? triggeredBy, CancellationToken ct)
    {
        _triggeredBy = triggeredBy;
        return await InvokeInternalAsync(agentKey, input, parentRunId: null, depth: 0, ct);
    }

    /// <summary>Recursive call used by executors via <see cref="IAgentRuntime"/>.</summary>
    public async Task<AgentResult> CallAgentAsync(string agentKey, string? input, CancellationToken ct)
    {
        var depth = _stack.Count;
        if (depth >= MaxDepth)
            throw new InvalidOperationException($"Max agent recursion depth ({MaxDepth}) reached when calling '{agentKey}'.");
        if (_stack.Any(s => s.AgentKey == agentKey))
            throw new InvalidOperationException($"Cycle detected when calling '{agentKey}'.");

        var parentRunId = _stack.Peek().RunId;
        var run = await InvokeInternalAsync(agentKey, input, parentRunId, depth, ct);
        return new AgentResult(run.Output ?? string.Empty, run.Summary ?? string.Empty, run.TokensIn, run.TokensOut, run.LatencyMs);
    }

    private async Task<HrAgentRun> InvokeInternalAsync(string agentKey, string? input, Guid? parentRunId, int depth, CancellationToken ct)
    {
        var agent = await db.HrAgents.FirstOrDefaultAsync(a => a.Key == agentKey, ct)
            ?? throw new InvalidOperationException($"Unknown agent '{agentKey}'.");
        if (!agent.Enabled)
            throw new InvalidOperationException($"Agent '{agentKey}' is paused and cannot be invoked.");

        var run = HrAgentRun.Start(agent.TenantId, agent.Key, agent.Name, agent.Stage, agent.Model, input, _triggeredBy, parentRunId, depth);
        db.HrAgentRuns.Add(run);
        await db.SaveChangesAsync(ct);

        _stack.Push((run.Id, agent.Key));
        try
        {
            var result = await executor.RunAsync(
                new AgentInvocation(agent.Key, agent.Stage, agent.Name, agent.Model, input),
                this, ct);
            run.Complete(result.Output, result.Summary, result.TokensIn, result.TokensOut, result.LatencyMs);
        }
        catch (Exception ex)
        {
            run.Status = "failed";
            run.Output = ex.Message;
            run.CompletedAtUtc = DateTime.UtcNow;
            logger.LogWarning(ex, "Agent {AgentKey} failed", agent.Key);
        }
        finally
        {
            _stack.Pop();
        }
        await db.SaveChangesAsync(ct);
        return run;
    }
}
