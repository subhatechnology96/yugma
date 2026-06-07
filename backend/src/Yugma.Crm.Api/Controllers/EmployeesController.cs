using Yugma.Crm.Api.Access;
using Yugma.Crm.Application.Hr.Employees;
using Yugma.Crm.Application.Hr.Employees.Commands;
using Yugma.Crm.Application.Hr.Employees.Queries;
using Yugma.Crm.Shared.Paging;
using Yugma.Crm.Shared.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

[ApiController]
[Route("api/my-work/employees")]
[Produces("application/json")]
[Authorize] // identity needed to scope the directory; HR / admins see all, others see only themselves
public sealed class EmployeesController(ISender mediator, HrAccess access) : ControllerBase
{
    /// <summary>Tells the client what the current user may do on the Employees screen.</summary>
    [HttpGet("access")]
    public async Task<IActionResult> Access(CancellationToken ct)
    {
        var a = await access.ResolveAsync(ct);
        return Ok(new
        {
            employeeId = a.SelfId,
            name = a.SelfName,
            department = a.Self?.Department,
            isHr = a.IsHr,
            canManageDirectory = a.CanManage,
            canAddEmployee = a.CanManage,
            isTeamLead = a.IsTeamLead,
            scope = a.Scope
        });
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<EmployeeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? department = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = "fullName",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
    {
        var a = await access.ResolveAsync(ct);
        // Managers see only their own row (or their team if a lead); HR/admins see all (VisibleIds == null).
        var restrictToIds = a.VisibleIds?.ToArray();
        var result = await mediator.Send(new ListEmployeesQuery(page, pageSize, search, department, status, sortBy, sortDir, restrictToIds), ct);
        return ToActionResult(result);
    }

    /// <summary>The current user's team — everyone who reports to them, directly or transitively (excludes self).</summary>
    [HttpGet("team")]
    [ProducesResponseType(typeof(PagedResult<EmployeeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Team(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? department = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = "fullName",
        [FromQuery] string? sortDir = "asc",
        CancellationToken ct = default)
    {
        var a = await access.ResolveAsync(ct);
        // Strictly the user's reports. An empty set (no reports) returns no rows by design.
        var ids = a.ManagedIds.ToArray();
        var result = await mediator.Send(new ListEmployeesQuery(page, pageSize, search, department, status, sortBy, sortDir, ids), ct);
        return ToActionResult(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var a = await access.ResolveAsync(ct);
        // Scope detail reads the same way as the directory: admins see anyone, HR their book, leads their team, others themselves.
        if (!a.CanSeeEmployee(id))
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", message = "You can only view employees you are responsible for." });

        var result = await mediator.Send(new GetEmployeeByIdQuery(id), ct);
        return ToActionResult(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeCommand cmd, CancellationToken ct)
    {
        var a = await access.ResolveAsync(ct);
        if (!a.CanManage)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", message = "Only HR or an administrator can add employees." });

        var result = await mediator.Send(cmd, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmployeeBody body, CancellationToken ct)
    {
        var cmd = new UpdateEmployeeCommand(id, body.Email, body.Phone, body.Department, body.Designation, body.Location, body.Manager, body.Skills);
        return ToActionResult(await mediator.Send(cmd, ct));
    }

    [HttpPost("{id:guid}/status")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeStatusBody body, CancellationToken ct)
    {
        return ToActionResult(await mediator.Send(new ChangeEmployeeStatusCommand(id, body.Status), ct));
    }

    /// <summary>Assigns (or clears, when hrPartnerId is null) the HR person responsible for this employee.</summary>
    [HttpPut("{id:guid}/hr-partner")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AssignHrPartner(Guid id, [FromBody] AssignHrPartnerBody body, CancellationToken ct)
    {
        var a = await access.ResolveAsync(ct);
        if (!a.CanManage)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", message = "Only HR or an administrator can assign HR partners." });

        return ToActionResult(await mediator.Send(new AssignHrPartnerCommand(id, body.HrPartnerId), ct));
    }

    /// <summary>Sets an employee's statutory IDs (PAN/UAN/PF) and bank details (shown on the payslip).</summary>
    [HttpPut("{id:guid}/statutory")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetStatutory(Guid id, [FromBody] StatutoryBody body, CancellationToken ct)
    {
        var a = await access.ResolveAsync(ct);
        if (!a.CanManageEmployee(id))
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", message = "You can only edit employees you are responsible for." });

        return ToActionResult(await mediator.Send(new SetEmployeeStatutoryCommand(id, body.Gender, body.Pan, body.Uan, body.PfNumber, body.BankName, body.BankAccount), ct));
    }

    private IActionResult ToActionResult<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        return result.Error.Type switch
        {
            ErrorType.NotFound => NotFound(new { error = result.Error.Code, message = result.Error.Message }),
            ErrorType.Validation => BadRequest(new { error = result.Error.Code, message = result.Error.Message }),
            ErrorType.Conflict => Conflict(new { error = result.Error.Code, message = result.Error.Message }),
            ErrorType.Unauthorized => Unauthorized(new { error = result.Error.Code, message = result.Error.Message }),
            _ => BadRequest(new { error = result.Error.Code, message = result.Error.Message })
        };
    }

    public sealed record UpdateEmployeeBody(string Email, string Phone, string Department, string Designation, string Location, string? Manager, IReadOnlyList<string> Skills);
    public sealed record ChangeStatusBody(string Status);
    public sealed record AssignHrPartnerBody(Guid? HrPartnerId);
    public sealed record StatutoryBody(string? Gender, string? Pan, string? Uan, string? PfNumber, string? BankName, string? BankAccount);
}
