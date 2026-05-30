using System.Text.Json;
using FluentValidation;

namespace Yugma.Crm.Api.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (ValidationException ex)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            ctx.Response.ContentType = "application/problem+json";
            var problem = new
            {
                type = "https://yugma.io/errors/validation",
                title = "One or more validation errors occurred.",
                status = 400,
                errors = ex.Errors.GroupBy(e => e.PropertyName).ToDictionary(
                    g => string.IsNullOrEmpty(g.Key) ? "_" : g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()),
                traceId = ctx.TraceIdentifier
            };
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(problem));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/problem+json";
            var problem = new
            {
                type = "https://yugma.io/errors/internal",
                title = "An unexpected error occurred.",
                status = 500,
                traceId = ctx.TraceIdentifier
            };
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(problem));
        }
    }
}
