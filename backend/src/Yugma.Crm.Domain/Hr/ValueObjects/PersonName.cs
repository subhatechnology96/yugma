using Yugma.Crm.Domain.Common;

namespace Yugma.Crm.Domain.Hr.ValueObjects;

public sealed class PersonName : ValueObject
{
    public string First { get; }
    public string Last { get; }
    public string Full => string.IsNullOrWhiteSpace(Last) ? First : $"{First} {Last}";

    private PersonName(string first, string last)
    {
        First = first;
        Last = last;
    }

    public static PersonName Create(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("Name is required.", nameof(fullName));
        var parts = fullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return new PersonName(parts[0], parts.Length > 1 ? parts[1] : string.Empty);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return First;
        yield return Last;
    }
}
