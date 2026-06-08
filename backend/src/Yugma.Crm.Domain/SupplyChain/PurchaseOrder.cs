using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.SupplyChain;

/// <summary>Lifecycle of a purchase order: request for quotation → confirmed purchase → received.</summary>
public enum PurchaseStatus { Rfq, Sent, Purchase, Received, Cancelled }

/// <summary>One order line on a purchase order. Stored as JSON.</summary>
public sealed class PurchaseLine
{
    public string Product { get; set; } = default!;
    public string? Description { get; set; }
    public decimal Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal TaxPercent { get; set; } = 18;

    public decimal Subtotal => Math.Round(Quantity * UnitPrice, 2);
    public decimal TaxAmount => Math.Round(Subtotal * TaxPercent / 100m, 2);
}

/// <summary>A purchase order to a vendor (RFQ → Purchase → Received).</summary>
public sealed class PurchaseOrder : Entity<Guid>, IAggregateRoot
{
    public string Number { get; private set; } = default!;
    public PurchaseStatus Status { get; private set; }
    public string Vendor { get; private set; } = default!;
    public string? VendorEmail { get; private set; }
    public DateOnly OrderDate { get; private set; }
    public DateOnly? ExpectedDate { get; private set; }
    public string? Responsible { get; private set; }
    public string? Notes { get; private set; }

    public decimal UntaxedAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal Total { get; private set; }

    public List<PurchaseLine> Lines { get; private set; } = new();

    private PurchaseOrder() { }

    public static PurchaseOrder Create(Guid tenantId, string number, string vendor, DateOnly orderDate,
        PurchaseStatus status = PurchaseStatus.Rfq, DateOnly? expectedDate = null, string? vendorEmail = null,
        string? responsible = null, string? notes = null, IEnumerable<PurchaseLine>? lines = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(vendor)) throw new ArgumentException("Vendor is required.", nameof(vendor));
        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Number = number.Trim(),
            Status = status,
            Vendor = vendor.Trim(),
            VendorEmail = string.IsNullOrWhiteSpace(vendorEmail) ? null : vendorEmail.Trim(),
            OrderDate = orderDate,
            ExpectedDate = expectedDate,
            Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        if (lines is not null) po.Lines.AddRange(lines);
        po.Recompute();
        return po;
    }

    public void SetLines(IEnumerable<PurchaseLine> lines, string? by) { Lines = lines?.ToList() ?? new(); Recompute(); Touch(by); }
    public void UpdateHeader(string vendor, string? vendorEmail, DateOnly orderDate, DateOnly? expectedDate, string? responsible, string? notes, string? by)
    {
        if (!string.IsNullOrWhiteSpace(vendor)) Vendor = vendor.Trim();
        VendorEmail = string.IsNullOrWhiteSpace(vendorEmail) ? null : vendorEmail.Trim();
        OrderDate = orderDate; ExpectedDate = expectedDate;
        Responsible = string.IsNullOrWhiteSpace(responsible) ? null : responsible.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Touch(by);
    }

    public void Send(string? by) { if (Status == PurchaseStatus.Rfq) Status = PurchaseStatus.Sent; Touch(by); }
    public void Confirm(string? by) { if (Status is PurchaseStatus.Rfq or PurchaseStatus.Sent) Status = PurchaseStatus.Purchase; Touch(by); }
    public void Receive(string? by) { if (Status == PurchaseStatus.Purchase) Status = PurchaseStatus.Received; Touch(by); }
    public void Cancel(string? by) { Status = PurchaseStatus.Cancelled; Touch(by); }
    public void SetDraft(string? by) { Status = PurchaseStatus.Rfq; Touch(by); }

    private void Recompute()
    {
        UntaxedAmount = Math.Round(Lines.Sum(l => l.Subtotal), 2);
        TaxAmount = Math.Round(Lines.Sum(l => l.TaxAmount), 2);
        Total = UntaxedAmount + TaxAmount;
    }
    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
