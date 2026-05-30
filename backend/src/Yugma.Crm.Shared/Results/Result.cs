namespace Yugma.Crm.Shared.Results;

public sealed record Error(string Code, string Message, ErrorType Type = ErrorType.Failure)
{
    public static readonly Error None = new(string.Empty, string.Empty);
    public static Error NotFound(string message) => new("not_found", message, ErrorType.NotFound);
    public static Error Validation(string message) => new("validation", message, ErrorType.Validation);
    public static Error Conflict(string message) => new("conflict", message, ErrorType.Conflict);
    public static Error Unauthorized(string message) => new("unauthorized", message, ErrorType.Unauthorized);
}

public enum ErrorType
{
    Failure,
    NotFound,
    Validation,
    Conflict,
    Unauthorized
}

public class Result
{
    public bool IsSuccess { get; }
    public Error Error { get; }

    protected Result(bool success, Error error)
    {
        if (success && error != Error.None) throw new InvalidOperationException();
        if (!success && error == Error.None) throw new InvalidOperationException();
        IsSuccess = success;
        Error = error;
    }

    public static Result Success() => new(true, Error.None);
    public static Result<T> Success<T>(T value) => new(value, true, Error.None);
    public static Result Failure(Error error) => new(false, error);
    public static Result<T> Failure<T>(Error error) => new(default!, false, error);
}

public sealed class Result<T> : Result
{
    public T Value { get; }

    internal Result(T value, bool success, Error error) : base(success, error) => Value = value;

    public static implicit operator Result<T>(T value) => Success(value);
}
