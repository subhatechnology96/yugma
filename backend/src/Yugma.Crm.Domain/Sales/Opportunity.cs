using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Sales;

/// <summary>The CRM pipeline stage an opportunity sits in.</summary>
public enum SalesStage { New, Qualified, Proposition, Won, Lost }

/// <summary>A planned or logged follow-up on an opportunity (call, meeting, e-mail, quotation…). Stored as JSON.</summary>
public sealed class SalesActivity
{
    public string Kind { get; set; } = "todo";   // call | meeting | email | quotation | todo | note | stage
    public string Summary { get; set; } = default!;
    public DateOnly? DueDate { get; set; }
    public bool Done { get; set; }
    public string? By { get; set; }
    public DateTime At { get; set; }
}

/// <summary>A CRM lead/opportunity flowing through the sales pipeline (New → Won).</summary>
public sealed class Opportunity : Entity<Guid>, IAggregateRoot
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public SalesStage Stage { get; private set; }
    public string Customer { get; private set; } = default!;
    public string? ContactName { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? Salesperson { get; private set; }
    public decimal ExpectedRevenue { get; private set; }
    public decimal Probability { get; private set; }   // 0–100
    public int Priority { get; private set; }            // 0–3 (stars)
    public DateOnly? ExpectedClosing { get; private set; }
    public string? Source { get; private set; }
    public string? Description { get; private set; }

    private readonly List<string> _tags = new();
    public IReadOnlyList<string> Tags => _tags.AsReadOnly();

    public List<SalesActivity> Activities { get; private set; } = new();

    private Opportunity() { } // EF

    /// <summary>Default win-probability for a stage, used when the stage changes.</summary>
    public static decimal DefaultProbability(SalesStage s) => s switch
    {
        SalesStage.New => 10,
        SalesStage.Qualified => 30,
        SalesStage.Proposition => 60,
        SalesStage.Won => 100,
        SalesStage.Lost => 0,
        _ => 10
    };

    public static Opportunity Create(
        Guid tenantId, string code, string name, string customer,
        SalesStage stage = SalesStage.New, decimal expectedRevenue = 0, decimal? probability = null,
        int priority = 0, string? contactName = null, string? email = null, string? phone = null,
        string? salesperson = null, DateOnly? expectedClosing = null, string? source = null,
        string? description = null, IEnumerable<string>? tags = null, string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(customer)) throw new ArgumentException("Customer is required.", nameof(customer));

        var o = new Opportunity
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code.Trim(),
            Name = name.Trim(),
            Stage = stage,
            Customer = customer.Trim(),
            ContactName = Clean(contactName),
            Email = Clean(email),
            Phone = Clean(phone),
            Salesperson = Clean(salesperson),
            ExpectedRevenue = expectedRevenue < 0 ? 0 : expectedRevenue,
            Probability = probability ?? DefaultProbability(stage),
            Priority = Math.Clamp(priority, 0, 3),
            ExpectedClosing = expectedClosing,
            Source = Clean(source),
            Description = Clean(description),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
        if (tags is not null) o._tags.AddRange(tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()));
        o.Activities.Add(new SalesActivity { Kind = "stage", Summary = "Opportunity created", By = createdBy, At = DateTime.UtcNow, Done = true });
        return o;
    }

    public void MoveStage(SalesStage stage, string? by, string? note = null)
    {
        if (stage == Stage) return;
        var from = Stage;
        Stage = stage;
        // Snap probability to the stage default unless the user has set a custom value above it.
        Probability = DefaultProbability(stage);
        Activities.Add(new SalesActivity
        {
            Kind = "stage",
            Summary = string.IsNullOrWhiteSpace(note) ? $"{from} → {stage}" : note!.Trim(),
            By = by,
            At = DateTime.UtcNow,
            Done = true
        });
        Touch(by);
    }

    public void Update(string name, string customer, string? contactName, string? email, string? phone,
        string? salesperson, decimal expectedRevenue, decimal probability, int priority, DateOnly? expectedClosing,
        string? source, string? description, IEnumerable<string>? tags, string? by)
    {
        if (!string.IsNullOrWhiteSpace(name)) Name = name.Trim();
        if (!string.IsNullOrWhiteSpace(customer)) Customer = customer.Trim();
        ContactName = Clean(contactName);
        Email = Clean(email);
        Phone = Clean(phone);
        Salesperson = Clean(salesperson);
        ExpectedRevenue = expectedRevenue < 0 ? 0 : expectedRevenue;
        Probability = Math.Clamp(probability, 0, 100);
        Priority = Math.Clamp(priority, 0, 3);
        ExpectedClosing = expectedClosing;
        Source = Clean(source);
        Description = Clean(description);
        _tags.Clear();
        if (tags is not null) _tags.AddRange(tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()));
        Touch(by);
    }

    public void AddActivity(string kind, string summary, DateOnly? dueDate, string? by)
    {
        if (string.IsNullOrWhiteSpace(summary)) throw new ArgumentException("Summary is required.", nameof(summary));
        Activities.Add(new SalesActivity { Kind = string.IsNullOrWhiteSpace(kind) ? "todo" : kind.Trim(), Summary = summary.Trim(), DueDate = dueDate, By = by, At = DateTime.UtcNow });
        Touch(by);
    }

    public void CompleteActivity(int index, string? by)
    {
        if (index < 0 || index >= Activities.Count) return;
        Activities[index].Done = true;
        Touch(by);
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
    private void Touch(string? user) { UpdatedAt = DateTime.UtcNow; UpdatedBy = user; }
}
