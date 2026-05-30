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
    // CRM role-based policies. Sales Manager + admin can manage everything;
    // Sales Rep can read & edit; Viewer is read-only.
    options.AddPolicy("CrmView", p => p.RequireRole("admin", "SalesManager", "SalesRep", "Viewer"));
    options.AddPolicy("CrmEdit", p => p.RequireRole("admin", "SalesManager", "SalesRep"));
    options.AddPolicy("CrmManage", p => p.RequireRole("admin", "SalesManager"));

    // HR / org policies (roles are issued lower-cased; owner also carries "admin").
    // HrManage: who may change people/hierarchy/teams.  UserManage: who may administer user accounts.
    options.AddPolicy("HrManage", p => p.RequireRole("admin", "owner", "manager", "hr", "super_admin"));
    options.AddPolicy("UserManage", p => p.RequireRole("admin", "owner", "hr", "super_admin"));
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

app.UseHttpsRedirection();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Apply pending migrations + seed demo data on startup
await DataSeeder.SeedAsync(app.Services);
// Materialise employee personal profiles (generation logic lives in the API layer)
await Yugma.Crm.Api.Profile.ProfileSeeder.SeedAsync(app.Services);

app.Run();
