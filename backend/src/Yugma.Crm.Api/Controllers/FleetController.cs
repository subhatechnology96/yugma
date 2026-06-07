using Yugma.Crm.Api.Access;
using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Hr.Fleet;
using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/fleet")]
[Produces("application/json")]
[Authorize] // HR / admins only — gated by the action filter below
public sealed class FleetController(YugmaDbContext db, ITenantContext tenant, HrAccess access) : ControllerBase, IAsyncActionFilter
{
    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if ((await access.ResolveAsync(context.HttpContext.RequestAborted)).Restricted)
        {
            context.Result = new ObjectResult(new { message = "Fleet is available to HR and administrators only." }) { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }
        await next();
    }

    private string Actor() => (access.ResolveAsync().GetAwaiter().GetResult()).SelfName ?? tenant.UserName ?? "HR";

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = db.Vehicles.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<VehicleStatus>(status, true, out var s)) q = q.Where(v => v.Status == s);
        var rows = await q.OrderBy(v => v.Name).ToListAsync(ct);
        return Ok(rows.Select(ToDto));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var all = await db.Vehicles.AsNoTracking().ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        int Count(VehicleStatus s) => all.Count(v => v.Status == s);
        return Ok(new
        {
            total = all.Count,
            available = Count(VehicleStatus.Available),
            inUse = Count(VehicleStatus.InUse),
            maintenance = Count(VehicleStatus.Maintenance),
            serviceDue = all.Count(v => v.NextServiceAt is { } d && d <= today.AddDays(14) && v.Status != VehicleStatus.Retired),
            byType = Enum.GetValues<VehicleType>().Select(t => new { type = t.ToString(), count = all.Count(v => v.Type == t) }).Where(x => x.count > 0)
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] VehicleBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Plate))
            return BadRequest(new { message = "Name and plate are required." });
        var type = Enum.TryParse<VehicleType>(body.Type, true, out var t) ? t : VehicleType.Car;
        var status = Enum.TryParse<VehicleStatus>(body.Status, true, out var s) ? s : VehicleStatus.Available;
        var v = Vehicle.Create(tenant.TenantId, body.Name!, body.Plate!, type, body.AcquiredAt ?? DateOnly.FromDateTime(DateTime.UtcNow),
            status, body.AssignedTo, body.FuelType ?? "Petrol", body.OdometerKm ?? 0, body.NextServiceAt, body.Notes, Actor());
        db.Vehicles.Add(v);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(v));
    }

    [HttpPost("{id:guid}/assign")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignBody body, CancellationToken ct)
        => await Mutate(id, v => v.Assign(body.AssignedTo, Actor()), ct);

    [HttpPost("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] StatusBody body, CancellationToken ct)
    {
        if (!Enum.TryParse<VehicleStatus>(body.Status, true, out var s)) return BadRequest(new { message = "Invalid status." });
        return await Mutate(id, v => v.SetStatus(s, Actor()), ct);
    }

    [HttpPost("{id:guid}/service")]
    public async Task<IActionResult> Service(Guid id, [FromBody] ServiceBody body, CancellationToken ct)
        => await Mutate(id, v => v.LogService(body.NextServiceAt, body.OdometerKm, Actor()), ct);

    private async Task<IActionResult> Mutate(Guid id, Action<Vehicle> apply, CancellationToken ct)
    {
        var v = await db.Vehicles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();
        apply(v);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(v));
    }

    private static object ToDto(Vehicle v) => new
    {
        id = v.Id, name = v.Name, plate = v.Plate, type = v.Type.ToString(), status = v.Status.ToString().ToLowerInvariant(),
        assignedTo = v.AssignedTo, fuelType = v.FuelType, odometerKm = v.OdometerKm, acquiredAt = v.AcquiredAt, nextServiceAt = v.NextServiceAt, notes = v.Notes
    };

    public sealed record VehicleBody(string? Name, string? Plate, string? Type, string? Status, string? AssignedTo, string? FuelType, int? OdometerKm, DateOnly? AcquiredAt, DateOnly? NextServiceAt, string? Notes);
    public sealed record AssignBody(string? AssignedTo);
    public sealed record StatusBody(string Status);
    public sealed record ServiceBody(DateOnly? NextServiceAt, int? OdometerKm);
}
