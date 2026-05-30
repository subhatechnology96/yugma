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
[Route("api/hr/employees")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class EmployeesController(ISender mediator) : ControllerBase
{
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
        var result = await mediator.Send(new ListEmployeesQuery(page, pageSize, search, department, status, sortBy, sortDir), ct);
        return ToActionResult(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetEmployeeByIdQuery(id), ct);
        return ToActionResult(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeCommand cmd, CancellationToken ct)
    {
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
}
