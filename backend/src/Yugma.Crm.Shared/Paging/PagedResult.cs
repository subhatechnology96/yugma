namespace Yugma.Crm.Shared.Paging;

public sealed record PageRequest(int Page = 1, int PageSize = 20, string? Search = null, string? SortBy = null, string? SortDir = "asc")
{
    public int Skip => Math.Max(0, (Page - 1) * PageSize);
    public int Take => Math.Clamp(PageSize, 1, 200);
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
