using Yugma.Crm.Shared.Results;
using Microsoft.AspNetCore.Mvc;

namespace Yugma.Crm.Api.Controllers;

// Shared Result<T> → IActionResult mapping for all CRM controllers.
public abstract class CrmControllerBase : ControllerBase
{
    protected IActionResult ToActionResult<T>(Result<T> result)
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
}
