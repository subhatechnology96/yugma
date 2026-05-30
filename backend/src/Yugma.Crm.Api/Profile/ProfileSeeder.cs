using Yugma.Crm.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Yugma.Crm.Api.Profile;

/// <summary>
/// Materialises one <c>employee_profiles</c> row per employee using the deterministic generator. Lives in
/// the API layer (not the infrastructure DataSeeder) because the generation logic sits in
/// <see cref="EmployeeProfileFactory"/>, which Infrastructure cannot reference. Idempotent.
/// </summary>
public static class ProfileSeeder
{
    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<YugmaDbContext>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var employees = await db.Employees.IgnoreQueryFilters().ToListAsync(ct);
        var have = (await db.EmployeeProfiles.IgnoreQueryFilters().Select(p => p.EmployeeId).ToListAsync(ct)).ToHashSet();

        var toAdd = employees.Where(e => !have.Contains(e.Id))
            .Select(e => EmployeeProfileFactory.GenerateProfile(e, today))
            .ToList();

        if (toAdd.Count > 0)
        {
            db.EmployeeProfiles.AddRange(toAdd);
            await db.SaveChangesAsync(ct);
        }
    }
}
