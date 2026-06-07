using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.Fleet;

public enum VehicleType { Car, Van, Truck, Bike, Bus }
public enum VehicleStatus { Available, InUse, Maintenance, Retired }

/// <summary>A company fleet vehicle, with its assigned driver, status and service schedule.</summary>
public sealed class Vehicle : Entity<Guid>, IAggregateRoot
{
    public string Name { get; private set; } = default!;              // model, e.g. "Toyota Innova"
    public string Plate { get; private set; } = default!;
    public VehicleType Type { get; private set; }
    public VehicleStatus Status { get; private set; }
    public string? AssignedTo { get; private set; }                   // driver / employee
    public string FuelType { get; private set; } = "Petrol";
    public int OdometerKm { get; private set; }
    public DateOnly AcquiredAt { get; private set; }
    public DateOnly? NextServiceAt { get; private set; }
    public string? Notes { get; private set; }

    private Vehicle() { } // EF

    public static Vehicle Create(Guid tenantId, string name, string plate, VehicleType type, DateOnly acquiredAt,
        VehicleStatus status = VehicleStatus.Available, string? assignedTo = null, string fuelType = "Petrol",
        int odometerKm = 0, DateOnly? nextServiceAt = null, string? notes = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(plate)) throw new ArgumentException("Plate is required.", nameof(plate));
        return new Vehicle
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name.Trim(),
            Plate = plate.Trim().ToUpperInvariant(),
            Type = type,
            Status = status,
            AssignedTo = string.IsNullOrWhiteSpace(assignedTo) ? null : assignedTo.Trim(),
            FuelType = string.IsNullOrWhiteSpace(fuelType) ? "Petrol" : fuelType.Trim(),
            OdometerKm = odometerKm < 0 ? 0 : odometerKm,
            AcquiredAt = acquiredAt,
            NextServiceAt = nextServiceAt,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Assign(string? driver, string? by)
    {
        AssignedTo = string.IsNullOrWhiteSpace(driver) ? null : driver.Trim();
        if (AssignedTo is not null && Status == VehicleStatus.Available) Status = VehicleStatus.InUse;
        if (AssignedTo is null && Status == VehicleStatus.InUse) Status = VehicleStatus.Available;
        Touch(by);
    }

    public void SetStatus(VehicleStatus status, string? by) { Status = status; Touch(by); }

    public void LogService(DateOnly? nextServiceAt, int? odometerKm, string? by)
    {
        if (nextServiceAt is { } d) NextServiceAt = d;
        if (odometerKm is { } o && o >= OdometerKm) OdometerKm = o;
        Touch(by);
    }

    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
