using Yugma.Crm.Domain.Agents;
using Yugma.Crm.Infrastructure.Agents;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/agents")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class AgentsController(YugmaDbContext db, AgentRuntime runtime) : ControllerBase
{
    /// <summary>Allowlist of models that can be set on any agent.</summary>
    private static readonly string[] AllowedModels = new[]
    {
        "gpt-5", "gpt-5-vision", "gpt-4o", "gpt-4o-mini",
        "claude-opus-4.7", "claude-sonnet-4.6", "claude-haiku-4.5",
        "gemini-2.5-pro", "gemini-2.5-flash",
        "embedding", "llama-3-70b"
    };

    [HttpGet("models")]
    public IActionResult Models() => Ok(AllowedModels);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var agents = await db.HrAgents.AsNoTracking().OrderBy(a => a.Stage).ThenBy(a => a.Name).ToListAsync(ct);

        var since30 = DateTime.UtcNow.AddDays(-30);
        var since24 = DateTime.UtcNow.AddHours(-24);

        var stats = await db.HrAgentRuns.AsNoTracking()
            .Where(r => r.StartedAtUtc >= since30)
            .GroupBy(r => r.AgentKey)
            .Select(g => new
            {
                key = g.Key,
                runs = g.Count(),
                lastRunAt = g.Max(r => r.StartedAtUtc),
                avgLatency = (int)g.Average(r => r.LatencyMs),
                tokens = g.Sum(r => r.TokensIn + r.TokensOut),
                successes = g.Count(r => r.Status == "succeeded"),
                failures = g.Count(r => r.Status == "failed")
            })
            .ToListAsync(ct);
        var statByKey = stats.ToDictionary(s => s.key);

        // Last run per agent — needed to decide error vs online.
        var lastRun = await db.HrAgentRuns.AsNoTracking()
            .GroupBy(r => r.AgentKey)
            .Select(g => g.OrderByDescending(r => r.StartedAtUtc)
                          .Select(r => new { r.AgentKey, r.Status, r.StartedAtUtc })
                          .First())
            .ToListAsync(ct);
        var lastByKey = lastRun.ToDictionary(x => x.AgentKey);

        var rows = agents.Select(a =>
        {
            statByKey.TryGetValue(a.Key, out var s);
            lastByKey.TryGetValue(a.Key, out var last);

            string status;
            if (!a.Enabled) status = "disabled";
            else if (last is not null && last.Status == "failed" && last.StartedAtUtc >= since24) status = "error";
            else if ((s?.successes ?? 0) > 0) status = "online";
            else status = "idle";

            return new
            {
                id = a.Id,
                key = a.Key,
                stage = a.Stage,
                name = a.Name,
                tagline = a.Tagline,
                description = a.Description,
                icon = a.Icon,
                model = a.Model,
                capability = a.Capability,
                enabled = a.Enabled,
                status,
                runs30d = s?.runs ?? 0,
                successes30d = s?.successes ?? 0,
                failures30d = s?.failures ?? 0,
                lastRunAt = (DateTime?)s?.lastRunAt,
                lastRunStatus = last?.Status,
                avgLatencyMs = s?.avgLatency ?? 0,
                tokens30d = s?.tokens ?? 0
            };
        });
        return Ok(rows);
    }

    public sealed record AgentConfigBody(string? Model, bool? Enabled);

    [HttpPut("{key}/config")]
    public async Task<IActionResult> UpdateConfig(string key, [FromBody] AgentConfigBody body, CancellationToken ct)
    {
        var agent = await db.HrAgents.FirstOrDefaultAsync(a => a.Key == key, ct);
        if (agent is null) return NotFound(new { error = "unknown_agent" });

        if (!string.IsNullOrWhiteSpace(body.Model))
        {
            var m = body.Model.Trim();
            if (!AllowedModels.Contains(m, StringComparer.OrdinalIgnoreCase))
                return BadRequest(new { error = "invalid_model", message = $"Model must be one of: {string.Join(", ", AllowedModels)}" });
            agent.Model = m;
        }
        if (body.Enabled.HasValue) agent.Enabled = body.Enabled.Value;

        await db.SaveChangesAsync(ct);
        return Ok(new
        {
            id = agent.Id,
            key = agent.Key,
            model = agent.Model,
            enabled = agent.Enabled
        });
    }

    [HttpGet("runs")]
    public async Task<IActionResult> Runs([FromQuery] int take = 30, [FromQuery] string? agentKey = null, CancellationToken ct = default)
    {
        var q = db.HrAgentRuns.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(agentKey)) q = q.Where(r => r.AgentKey == agentKey);
        var rows = await q.OrderByDescending(r => r.StartedAtUtc)
            .Take(Math.Clamp(take, 1, 200))
            .Select(r => new
            {
                id = r.Id,
                agentKey = r.AgentKey,
                agentName = r.AgentName,
                stage = r.Stage,
                model = r.Model,
                status = r.Status,
                summary = r.Summary,
                output = r.Output,
                tokensIn = r.TokensIn,
                tokensOut = r.TokensOut,
                latencyMs = r.LatencyMs,
                triggeredBy = r.TriggeredBy,
                startedAt = r.StartedAtUtc,
                completedAt = r.CompletedAtUtc
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    public sealed record InvokeBody(string? Input, string? TriggeredBy);

    [HttpPost("{key}/invoke")]
    public async Task<IActionResult> Invoke(string key, [FromBody] InvokeBody body, CancellationToken ct)
    {
        HrAgentRun run;
        try
        {
            run = await runtime.InvokeAsync(key, body?.Input, body?.TriggeredBy ?? "demo", ct);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("paused"))
        {
            return BadRequest(new { error = "agent_disabled", message = ex.Message });
        }
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("Unknown agent"))
        {
            return NotFound(new { error = "unknown_agent", message = ex.Message });
        }

        // Count immediate children to surface "multi-step" runs to the client.
        var children = await db.HrAgentRuns.AsNoTracking()
            .Where(r => r.ParentRunId == run.Id)
            .OrderBy(r => r.StartedAtUtc)
            .Select(r => new
            {
                id = r.Id,
                agentKey = r.AgentKey,
                agentName = r.AgentName,
                model = r.Model,
                status = r.Status,
                summary = r.Summary,
                latencyMs = r.LatencyMs,
                tokensIn = r.TokensIn,
                tokensOut = r.TokensOut,
                startedAt = r.StartedAtUtc,
                completedAt = r.CompletedAtUtc
            })
            .ToListAsync(ct);

        return Ok(new
        {
            id = run.Id,
            agentKey = run.AgentKey,
            agentName = run.AgentName,
            stage = run.Stage,
            model = run.Model,
            status = run.Status,
            summary = run.Summary,
            output = run.Output,
            tokensIn = run.TokensIn,
            tokensOut = run.TokensOut,
            latencyMs = run.LatencyMs,
            startedAt = run.StartedAtUtc,
            completedAt = run.CompletedAtUtc,
            steps = children
        });
    }

    /// <summary>Return a run plus all descendant runs in execution order (full trace).</summary>
    [HttpGet("runs/{id:guid}/trace")]
    public async Task<IActionResult> Trace(Guid id, CancellationToken ct)
    {
        var root = await db.HrAgentRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (root is null) return NotFound();

        // Iterative breadth-first walk so any depth works.
        var collected = new List<HrAgentRun> { root };
        var frontier = new List<Guid> { id };
        while (frontier.Count > 0)
        {
            var children = await db.HrAgentRuns.AsNoTracking()
                .Where(r => r.ParentRunId != null && frontier.Contains(r.ParentRunId!.Value))
                .ToListAsync(ct);
            if (children.Count == 0) break;
            collected.AddRange(children);
            frontier = children.Select(c => c.Id).ToList();
        }

        var rows = collected
            .OrderBy(r => r.Depth)
            .ThenBy(r => r.StartedAtUtc)
            .Select(r => new
            {
                id = r.Id,
                parentRunId = r.ParentRunId,
                depth = r.Depth,
                agentKey = r.AgentKey,
                agentName = r.AgentName,
                stage = r.Stage,
                model = r.Model,
                status = r.Status,
                summary = r.Summary,
                output = r.Output,
                tokensIn = r.TokensIn,
                tokensOut = r.TokensOut,
                latencyMs = r.LatencyMs,
                startedAt = r.StartedAtUtc,
                completedAt = r.CompletedAtUtc
            });
        return Ok(rows);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        var since24 = DateTime.UtcNow.AddHours(-24);
        var since30 = DateTime.UtcNow.AddDays(-30);

        var runs24 = await db.HrAgentRuns.CountAsync(r => r.StartedAtUtc >= since24, ct);
        var runs30 = await db.HrAgentRuns.CountAsync(r => r.StartedAtUtc >= since30, ct);
        var tokens30 = await db.HrAgentRuns.Where(r => r.StartedAtUtc >= since30).SumAsync(r => (long)(r.TokensIn + r.TokensOut), ct);
        var avgLatency = await db.HrAgentRuns.Where(r => r.StartedAtUtc >= since30 && r.LatencyMs > 0).Select(r => (double?)r.LatencyMs).AverageAsync(ct) ?? 0;
        var agentCount = await db.HrAgents.CountAsync(a => a.Enabled, ct);

        var perStage = await db.HrAgents.GroupBy(a => a.Stage).Select(g => new { stage = g.Key, count = g.Count() }).ToListAsync(ct);

        return Ok(new
        {
            agentCount,
            runs24h = runs24,
            runs30d = runs30,
            tokens30d = tokens30,
            avgLatencyMs = (int)avgLatency,
            perStage
        });
    }
}
