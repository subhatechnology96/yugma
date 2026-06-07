using Yugma.Crm.Domain.Abstractions;
using Yugma.Crm.Domain.Agents;
using Yugma.Crm.Domain.Crm;
using Yugma.Crm.Domain.Hr;
using Yugma.Crm.Domain.Provisioning;
using Yugma.Crm.Infrastructure.Agents;
using Yugma.Crm.Infrastructure.Auth;
using Yugma.Crm.Infrastructure.Persistence;
using Yugma.Crm.Infrastructure.Persistence.Repositories;
using Yugma.Crm.Infrastructure.Provisioning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Yugma.Crm.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<YugmaDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("Postgres"), npg =>
            {
                npg.MigrationsAssembly(typeof(YugmaDbContext).Assembly.FullName);
                npg.MigrationsHistoryTable("__EFMigrationsHistory", "yugma");
            })
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<YugmaDbContext>());
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();

        services.AddScoped<IEmployeeProvisioningHook, EmployeeProvisioningHook>();
        services.AddScoped<IAgentExecutor, MockAgentExecutor>();
        services.AddScoped<AgentRuntime>();
        services.AddScoped<IAgentRuntime>(sp => sp.GetRequiredService<AgentRuntime>());

        services.AddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        services.Configure<JwtOptions>(config.GetSection("Jwt"));

        return services;
    }
}

internal sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
