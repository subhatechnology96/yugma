using System.Text.RegularExpressions;
using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.ValueObjects;

public sealed partial class Email : ValueObject
{
    public string Value { get; }
    private Email(string value) => Value = value;

    public static Email Create(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) throw new ArgumentException("Email is required.", nameof(raw));
        var normalized = raw.Trim().ToLowerInvariant();
        if (!EmailRegex().IsMatch(normalized))
            throw new ArgumentException("Invalid email address.", nameof(raw));
        return new Email(normalized);
    }

    public override string ToString() => Value;

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailRegex();
}
