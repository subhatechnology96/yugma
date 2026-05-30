using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.ValueObjects;

public sealed class PhoneNumber : ValueObject
{
    public string Value { get; }
    private PhoneNumber(string value) => Value = value;

    public static PhoneNumber Create(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) throw new ArgumentException("Phone is required.", nameof(raw));
        var digits = new string(raw.Where(c => char.IsDigit(c) || c == '+').ToArray());
        if (digits.Replace("+", string.Empty).Length < 7)
            throw new ArgumentException("Phone number is too short.", nameof(raw));
        return new PhoneNumber(digits);
    }

    public override string ToString() => Value;

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }
}
