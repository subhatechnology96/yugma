using System.Text;
using Yugma.Crm.Api.Middleware;
using Yugma.Crm.Application;
using Yugma.Crm.Infrastructure;
using Yugma.Crm.Infrastructure.Auth;
using Yugma.Crm.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.AddHttpContextAccessor();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<Yugma.Crm.Api.Access.HrAccess>();

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("frontend", p => p
        .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:4200" })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization(options =>
{
    // HR / org policies (roles are issued lower-cased; owner also carries "admin").
    // HrManage: who may change people/hierarchy/teams.  UserManage: who may administer user accounts.
    options.AddPolicy("HrManage", p => p.RequireRole("admin", "owner", "manager", "hr", "super_admin"));
    options.AddPolicy("UserManage", p => p.RequireRole("admin", "owner", "hr", "super_admin"));

    // Services module — dedicated access: the "services" role (granted to Services-department users in AuthController),
    // plus admins/owners. A generic manager from another department does not get in.
    options.AddPolicy("ServicesView", p => p.RequireRole("admin", "owner", "services", "super_admin"));
    options.AddPolicy("ServicesEdit", p => p.RequireRole("admin", "owner", "services", "super_admin"));

    // Finance module — dedicated access: the "finance" role (granted to Finance-department users), plus admins/owners.
    options.AddPolicy("FinanceView", p => p.RequireRole("admin", "owner", "finance", "super_admin"));
    options.AddPolicy("FinanceEdit", p => p.RequireRole("admin", "owner", "finance", "super_admin"));

    // Sales module (CRM pipeline + quotations) — the "sales" role (granted to Sales-department users), plus admins/owners.
    options.AddPolicy("SalesView", p => p.RequireRole("admin", "owner", "sales", "super_admin"));
    options.AddPolicy("SalesEdit", p => p.RequireRole("admin", "owner", "sales", "super_admin"));

    // Supply Chain module (Inventory/Manufacturing/PLM/Purchase/Maintenance/Quality) — the "supplychain" role, plus admins/owners.
    options.AddPolicy("SupplyChainView", p => p.RequireRole("admin", "owner", "supplychain", "super_admin"));
    options.AddPolicy("SupplyChainEdit", p => p.RequireRole("admin", "owner", "supplychain", "super_admin"));
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Yugma API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Bearer token. Example: 'Bearer {token}'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Behind Azure App Service, TLS is terminated at the platform (set "HTTPS Only" there),
// so app-level HTTPS redirection only runs locally to avoid proxy redirect loops.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Serve the bundled Angular SPA from wwwroot on the same host as the API.
// The frontend calls a relative "/api", so no CORS is needed in this single-host setup.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Non-API routes fall back to the SPA shell so Angular client-side routing works on refresh.
app.MapFallbackToFile("index.html");

// Apply pending migrations + seed demo data on startup
await DataSeeder.SeedAsync(app.Services);
// Materialise employee personal profiles (generation logic lives in the API layer)
await Yugma.Crm.Api.Profile.ProfileSeeder.SeedAsync(app.Services);

app.Run();
