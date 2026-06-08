using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Sales;

/// <summary>Lifecycle of a quotation as it becomes a confirmed sales order.</summary>
public enum QuotationStatus { Quotation, Sent, SalesOrder, Cancelled }

/// <summary>One order line on a quotation. Stored as JSON on the quotation.</summary>
public sealed class QuotationLine
{
    public string? ProductCode { get; set; }
    public string Product { get; set; } = default!;
    public string? Description { get; set; }
    public decimal Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal TaxPercent { get; set; } = 18;

    public decimal Subtotal => Math.Round(Quantity * UnitPrice, 2);
    public decimal TaxAmount => Math.Round(Subtotal * TaxPercent / 100m, 2);
}

/// <summary>A sales quotation that can be sent and confirmed into a sales order.</summary>
public sealed class Quotation : Entity<Guid>, IAggregateRoot
{
    public string Number { get; private set; } = default!;
    public QuotationStatus Status { get; private set; }
    public string Customer { get; private set; } = default!;
    public string? CustomerEmail { get; private set; }
    public string? CustomerAddress { get; private set; }
    public DateOnly OrderDate { get; private set; }
    public DateOnly? ExpiryDate { get; private set; }
    public string Pricelist { get; private set; } = "INR";
    public string PaymentTerms { get; private set; } = "30 Days";
    public string? Salesperson { get; private set; }
    public Guid? OpportunityId { get; private set; }
    public string? Notes { get; private set; }

    public decimal UntaxedAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal Total { get; private set; }

    public List<QuotationLine> Lines { get; private set; } = new();

    private Quotation() { } // EF

    public static Quotation Create(
        Guid tenantId, string number, string customer, DateOnly orderDate,
        QuotationStatus status = QuotationStatus.Quotation, DateOnly? expiryDate = null,
        string? customerEmail = null, string? customerAddress = null, string pricelist = "INR",
        string paymentTerms = "30 Days", string? salesperson = null, Guid? opportunityId = null,
        string? notes = null, IEnumerable<QuotationLine>? lines = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(customer)) throw new ArgumentException("Customer is required.", nameof(customer));
        var q = new Quotation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Number = number.Trim(),
            Status = status,
            Customer = customer.Trim(),
            CustomerEmail = Clean(customerEmail),
            CustomerAddress = Clean(customerAddress),
            OrderDate = orderDate,
            ExpiryDate = expiryDate,
            Pricelist = string.IsNullOrWhiteSpace(pricelist) ? "INR" : pricelist.Trim(),
            PaymentTerms = string.IsNullOrWhiteSpace(paymentTerms) ? "30 Days" : paymentTerms.Trim(),
            Salesperson = Clean(salesperson),
            OpportunityId = opportunityId,
            Notes = Clean(notes),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        if (lines is not null) q.Lines.AddRange(lines);
        q.Recompute();
        return q;
    }

    public void SetLines(IEnumerable<QuotationLine> lines, string? by)
    {
        Lines = lines?.ToList() ?? new List<QuotationLine>();
        Recompute();
        Touch(by);
    }

    public void UpdateHeader(string customer, string? customerEmail, string? customerAddress, DateOnly orderDate,
        DateOnly? expiryDate, string pricelist, string paymentTerms, string? salesperson, string? notes, string? by)
    {
        if (!string.IsNullOrWhiteSpace(customer)) Customer = customer.Trim();
        CustomerEmail = Clean(customerEmail);
        CustomerAddress = Clean(customerAddress);
        OrderDate = orderDate;
        ExpiryDate = expiryDate;
        Pricelist = string.IsNullOrWhiteSpace(pricelist) ? "INR" : pricelist.Trim();
        PaymentTerms = string.IsNullOrWhiteSpace(paymentTerms) ? "30 Days" : paymentTerms.Trim();
        Salesperson = Clean(salesperson);
        Notes = Clean(notes);
        Touch(by);
    }

    public void Send(string? by) { if (Status == QuotationStatus.Quotation) Status = QuotationStatus.Sent; Touch(by); }
    public void Confirm(string? by) { if (Status is QuotationStatus.Quotation or QuotationStatus.Sent) Status = QuotationStatus.SalesOrder; Touch(by); }
    public void Cancel(string? by) { Status = QuotationStatus.Cancelled; Touch(by); }
    public void SetDraft(string? by) { Status = QuotationStatus.Quotation; Touch(by); }

    private void Recompute()
    {
        UntaxedAmount = Math.Round(Lines.Sum(l => l.Subtotal), 2);
        TaxAmount = Math.Round(Lines.Sum(l => l.TaxAmount), 2);
        Total = UntaxedAmount + TaxAmount;
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
