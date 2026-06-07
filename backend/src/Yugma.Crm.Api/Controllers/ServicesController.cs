using System.Security.Claims;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Services;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/services")]
[Produces("application/json")]
[Authorize(Policy = "ServicesView")]
public sealed class ServicesController(YugmaDbContext db, ITenantContext tenant) : ControllerBase
{
    private static readonly string[] StageOrder = { "new", "scheduled", "inprogress", "review", "done", "cancelled" };

    private string Actor() => User.Identity?.Name ?? tenant.UserName ?? "Service desk";

    // ---------------- orders ----------------

    [HttpGet("orders")]
    public async Task<IActionResult> List([FromQuery] string? type = null, [FromQuery] string? stage = null, [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var q = db.ServiceOrders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<ServiceType>(type, true, out var t)) q = q.Where(o => o.Type == t);
        if (!string.IsNullOrWhiteSpace(stage) && Enum.TryParse<ServiceStage>(stage, true, out var s)) q = q.Where(o => o.Stage == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var k = search.Trim();
            q = q.Where(o => EF.Functions.ILike(o.Title, $"%{k}%") || EF.Functions.ILike(o.Customer, $"%{k}%") || EF.Functions.ILike(o.Code, $"%{k}%"));
        }
        var orders = await q.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        var hours = await HoursByOrderAsync(orders.Select(o => o.Id), ct);
        return Ok(orders.Select(o => ToDto(o, hours.GetValueOrDefault(o.Id), includeActivity: false)));
    }

    [HttpGet("orders/{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var o = await db.ServiceOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        var logged = await db.ServiceTimesheets.AsNoTracking().Where(t => t.OrderId == id).SumAsync(t => (decimal?)t.Hours, ct) ?? 0m;
        var timesheets = await db.ServiceTimesheets.AsNoTracking().Where(t => t.OrderId == id)
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.CreatedAt).ToListAsync(ct);
        return Ok(ToDto(o, logged, includeActivity: true, timesheets));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var orders = await db.ServiceOrders.AsNoTracking().ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        int Count(ServiceStage s) => orders.Count(o => o.Stage == s);
        var open = orders.Count(o => o.Stage is not (ServiceStage.Done or ServiceStage.Cancelled));
        var overdue = orders.Count(o => o.DueAt is { } d && d < today && o.Stage is not (ServiceStage.Done or ServiceStage.Cancelled));
        var loggedHours = await db.ServiceTimesheets.AsNoTracking().SumAsync(t => (decimal?)t.Hours, ct) ?? 0m;

        var byType = Enum.GetValues<ServiceType>().Select(t => new
        {
            type = t.ToString(),
            total = orders.Count(o => o.Type == t),
            open = orders.Count(o => o.Type == t && o.Stage is not (ServiceStage.Done or ServiceStage.Cancelled))
        });

        return Ok(new
        {
            totalOrders = orders.Count,
            open,
            overdue,
            done = Count(ServiceStage.Done),
            loggedHours,
            funnel = new
            {
                @new = Count(ServiceStage.New),
                scheduled = Count(ServiceStage.Scheduled),
                inProgress = Count(ServiceStage.InProgress),
                review = Count(ServiceStage.Review),
                done = Count(ServiceStage.Done),
                cancelled = Count(ServiceStage.Cancelled)
            },
            byType
        });
    }

    [HttpPost("orders")]
    [Authorize(Policy = "ServicesEdit")]
    public async Task<IActionResult> Create([FromBody] OrderBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Customer))
            return BadRequest(new { message = "Title and customer are required." });

        var type = Enum.TryParse<ServiceType>(body.Type, true, out var t) ? t : ServiceType.Project;
        var stage = Enum.TryParse<ServiceStage>(body.Stage, true, out var s) ? s : ServiceStage.New;
        var priority = Enum.TryParse<ServicePriority>(body.Priority, true, out var p) ? p : ServicePriority.Medium;

        var o = ServiceOrder.Create(tenant.TenantId, await NextCodeAsync(ct), body.Title!, type, body.Customer!,
            stage, priority, body.AssignedTo, body.ScheduledAt, body.DueAt,
            body.EstimatedHours ?? 0, body.Description, body.Tags, Actor());
        db.ServiceOrders.Add(o);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(o, 0m, includeActivity: true));
    }

    [HttpPut("orders/{id:guid}")]
    [Authorize(Policy = "ServicesEdit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] OrderBody body, CancellationToken ct)
    {
        var o = await db.ServiceOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        var type = Enum.TryParse<ServiceType>(body.Type, true, out var t) ? t : o.Type;
        var priority = Enum.TryParse<ServicePriority>(body.Priority, true, out var p) ? p : o.Priority;
        o.UpdateDetails(body.Title ?? o.Title, type, body.Customer ?? o.Customer, priority, body.DueAt,
            body.EstimatedHours ?? o.EstimatedHours, body.Description, body.Tags, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(await DtoWithHoursAsync(o, ct));
    }

    [HttpPost("orders/{id:guid}/stage")]
    [Authorize(Policy = "ServicesEdit")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveBody body, CancellationToken ct)
    {
        if (!Enum.TryParse<ServiceStage>(body.Stage, true, out var stage)) return BadRequest(new { message = "Invalid stage." });
        var o = await db.ServiceOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        o.MoveTo(stage, Actor(), body.Note);
        await db.SaveChangesAsync(ct);
        return Ok(await DtoWithHoursAsync(o, ct));
    }

    [HttpPost("orders/{id:guid}/assign")]
    [Authorize(Policy = "ServicesEdit")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignBody body, CancellationToken ct)
    {
        var o = await db.ServiceOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        o.Assign(body.AssignedTo, body.ScheduledAt, Actor(), body.Note);
        // Assigning a schedule naturally moves a brand-new order into the Scheduled stage.
        if (o.Stage == ServiceStage.New && body.ScheduledAt is not null) o.MoveTo(ServiceStage.Scheduled, Actor(), "Scheduled");
        await db.SaveChangesAsync(ct);
        return Ok(await DtoWithHoursAsync(o, ct));
    }

    [HttpPost("orders/{id:guid}/timesheet")]
    [Authorize(Policy = "ServicesEdit")]
    public async Task<IActionResult> LogTime(Guid id, [FromBody] TimesheetBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Person) || body.Hours <= 0)
            return BadRequest(new { message = "Person and a positive number of hours are required." });
        var o = await db.ServiceOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        var date = body.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        db.ServiceTimesheets.Add(ServiceTimesheet.Create(tenant.TenantId, id, body.Person!, date, body.Hours, body.Note, Actor()));
        o.LogTime(body.Person!, body.Hours, body.Note, Actor());
        await db.SaveChangesAsync(ct);
        return Ok(await DtoWithHoursAsync(o, ct));
    }

    // ---------------- timesheets view ----------------

    [HttpGet("timesheets")]
    public async Task<IActionResult> Timesheets([FromQuery] string? person = null, CancellationToken ct = default)
    {
        var entries = await db.ServiceTimesheets.AsNoTracking()
            .Where(t => person == null || t.Person == person)
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.CreatedAt).Take(300).ToListAsync(ct);
        var orderIds = entries.Select(e => e.OrderId).Distinct().ToList();
        var orders = await db.ServiceOrders.AsNoTracking().Where(o => orderIds.Contains(o.Id))
            .Select(o => new { o.Id, o.Code, o.Title, o.Type, o.Customer }).ToListAsync(ct);
        var byId = orders.ToDictionary(o => o.Id);

        var rows = entries.Select(e => new
        {
            id = e.Id,
            orderId = e.OrderId,
            code = byId.TryGetValue(e.OrderId, out var o) ? o.Code : null,
            title = byId.TryGetValue(e.OrderId, out var o2) ? o2.Title : "—",
            type = byId.TryGetValue(e.OrderId, out var o3) ? o3.Type.ToString() : null,
            customer = byId.TryGetValue(e.OrderId, out var o4) ? o4.Customer : null,
            person = e.Person,
            date = e.Date,
            hours = e.Hours,
            note = e.Note
        });

        var byPerson = entries.GroupBy(e => e.Person)
            .Select(g => new { person = g.Key, hours = g.Sum(x => x.Hours), entries = g.Count() })
            .OrderByDescending(x => x.hours);

        return Ok(new { entries = rows, byPerson, totalHours = entries.Sum(e => e.Hours) });
    }

    // ---------------- planning view ----------------

    [HttpGet("planning")]
    public async Task<IActionResult> Planning(CancellationToken ct)
    {
        var scheduled = await db.ServiceOrders.AsNoTracking()
            .Where(o => o.ScheduledAt != null && o.Stage != ServiceStage.Done && o.Stage != ServiceStage.Cancelled)
            .OrderBy(o => o.ScheduledAt).ToListAsync(ct);
        var hours = await HoursByOrderAsync(scheduled.Select(o => o.Id), ct);
        return Ok(scheduled.Select(o => ToDto(o, hours.GetValueOrDefault(o.Id), includeActivity: false)));
    }

    // ---------------- helpers ----------------

    private async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var max = await db.ServiceOrders.AsNoTracking()
            .Select(o => o.Code)
            .ToListAsync(ct);
        var next = max.Select(c => int.TryParse(c.Replace("SVC-", "", StringComparison.OrdinalIgnoreCase), out var n) ? n : 0)
            .DefaultIfEmpty(1000).Max() + 1;
        return $"SVC-{next}";
    }

    private async Task<Dictionary<Guid, decimal>> HoursByOrderAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return new();
        return await db.ServiceTimesheets.AsNoTracking()
            .Where(t => idList.Contains(t.OrderId))
            .GroupBy(t => t.OrderId)
            .Select(g => new { g.Key, Hours = g.Sum(x => x.Hours) })
            .ToDictionaryAsync(x => x.Key, x => x.Hours, ct);
    }

    private async Task<object> DtoWithHoursAsync(ServiceOrder o, CancellationToken ct)
    {
        var logged = await db.ServiceTimesheets.AsNoTracking().Where(t => t.OrderId == o.Id).SumAsync(t => (decimal?)t.Hours, ct) ?? 0m;
        return ToDto(o, logged, includeActivity: true);
    }

    private static object ToDto(ServiceOrder o, decimal loggedHours, bool includeActivity, List<ServiceTimesheet>? timesheets = null)
    {
        var pct = o.EstimatedHours > 0 ? (int)Math.Min(100, Math.Round(loggedHours / o.EstimatedHours * 100)) : 0;
        return new
        {
            id = o.Id,
            code = o.Code,
            title = o.Title,
            type = o.Type.ToString(),
            stage = o.Stage.ToString().ToLowerInvariant(),
            priority = o.Priority.ToString(),
            customer = o.Customer,
            assignedTo = o.AssignedTo,
            scheduledAt = o.ScheduledAt,
            dueAt = o.DueAt,
            estimatedHours = o.EstimatedHours,
            loggedHours,
            progress = pct,
            tags = o.Tags,
            description = o.Description,
            createdAt = o.CreatedAt,
            activity = includeActivity
                ? o.Activity.OrderByDescending(a => a.At).Select(a => new { kind = a.Kind, from = a.From, to = a.To, note = a.Note, by = a.By, at = a.At })
                : null,
            timesheets = timesheets?.Select(t => new { id = t.Id, person = t.Person, date = t.Date, hours = t.Hours, note = t.Note })
        };
    }

    public sealed record OrderBody(string? Title, string? Type, string? Stage, string? Priority, string? Customer, string? AssignedTo,
        DateTime? ScheduledAt, DateOnly? DueAt, decimal? EstimatedHours, string? Description, IReadOnlyList<string>? Tags);
    public sealed record MoveBody(string Stage, string? Note);
    public sealed record AssignBody(string? AssignedTo, DateTime? ScheduledAt, string? Note);
    public sealed record TimesheetBody(string? Person, decimal Hours, DateOnly? Date, string? Note);
}
