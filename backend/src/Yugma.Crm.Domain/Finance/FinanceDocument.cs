using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Finance;

/// <summary>Customer invoice (accounts receivable) or vendor bill (accounts payable).</summary>
public enum FinanceDocKind { CustomerInvoice, VendorBill }

/// <summary>Draft = "to validate"; Posted = open/unpaid (or "to pay"); Paid; Cancelled. "Late" is derived from the due date.</summary>
public enum FinanceDocStatus { Draft, Posted, Paid, Cancelled }

/// <summary>A posted accounting document — a customer invoice or a vendor bill — that flows Draft → Posted → Paid.</summary>
public sealed class FinanceDocument : Entity<Guid>, IAggregateRoot
{
    public string Number { get; private set; } = default!;
    public FinanceDocKind Kind { get; private set; }
    public FinanceDocStatus Status { get; private set; }
    public string Partner { get; private set; } = default!;          // customer or vendor
    public string? Reference { get; private set; }
    public DateOnly IssueDate { get; private set; }
    public DateOnly DueDate { get; private set; }
    public decimal Amount { get; private set; }                       // untaxed subtotal
    public decimal TaxAmount { get; private set; }
    public decimal Total { get; private set; }
    public decimal AmountPaid { get; private set; }
    public string? Notes { get; private set; }

    public decimal AmountDue => Total - AmountPaid;

    private FinanceDocument() { } // EF

    public static FinanceDocument Create(
        Guid tenantId, string number, FinanceDocKind kind, string partner, DateOnly issueDate, DateOnly dueDate,
        decimal amount, decimal taxAmount, FinanceDocStatus status = FinanceDocStatus.Draft,
        decimal amountPaid = 0, string? reference = null, string? notes = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(partner)) throw new ArgumentException("Partner is required.", nameof(partner));
        if (amount < 0) throw new ArgumentException("Amount cannot be negative.", nameof(amount));
        var total = amount + taxAmount;
        return new FinanceDocument
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Number = number.Trim(),
            Kind = kind,
            Status = status,
            Partner = partner.Trim(),
            Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim(),
            IssueDate = issueDate,
            DueDate = dueDate,
            Amount = amount,
            TaxAmount = taxAmount,
            Total = total,
            AmountPaid = status == FinanceDocStatus.Paid ? total : Math.Min(amountPaid, total),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    /// <summary>Posts a draft document so it becomes a real receivable/payable.</summary>
    public void Validate(string? by)
    {
        if (Status == FinanceDocStatus.Draft) Status = FinanceDocStatus.Posted;
        Touch(by);
    }

    /// <summary>Registers a payment; fully paying the document marks it Paid.</summary>
    public void RegisterPayment(decimal amount, string? by)
    {
        if (amount <= 0) throw new ArgumentException("Payment must be positive.", nameof(amount));
        if (Status == FinanceDocStatus.Draft) Status = FinanceDocStatus.Posted;
        AmountPaid = Math.Min(Total, AmountPaid + amount);
        if (AmountPaid >= Total) Status = FinanceDocStatus.Paid;
        Touch(by);
    }

    public void Cancel(string? by) { Status = FinanceDocStatus.Cancelled; Touch(by); }

    public void UpdateDetails(string partner, DateOnly issueDate, DateOnly dueDate, decimal amount, decimal taxAmount, string? reference, string? notes, string? by)
    {
        Partner = partner.Trim();
        IssueDate = issueDate;
        DueDate = dueDate;
        Amount = amount;
        TaxAmount = taxAmount;
        Total = amount + taxAmount;
        if (AmountPaid > Total) AmountPaid = Total;
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Touch(by);
    }

    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
