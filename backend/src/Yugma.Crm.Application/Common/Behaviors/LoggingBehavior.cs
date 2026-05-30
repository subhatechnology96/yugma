using System.Diagnostics;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Yugma.Crm.Application.Common.Behaviors;

public sealed class LoggingBehavior<TRequest, TResponse>(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var name = typeof(TRequest).Name;
        var sw = Stopwatch.StartNew();
        try
        {
            logger.LogInformation("→ {Request}", name);
            var response = await next();
            logger.LogInformation("✓ {Request} in {Elapsed} ms", name, sw.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "✗ {Request} failed in {Elapsed} ms", name, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
