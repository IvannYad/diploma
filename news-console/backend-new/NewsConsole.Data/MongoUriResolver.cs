using Microsoft.AspNetCore.Http;

namespace NewsConsole.Data;

public static class MongoUriResolver
{
    public const string HeaderName = "X-Mongo-Uri";
    public const string QueryParameterName = "mongo_uri";

    public static string? Resolve(IHttpContextAccessor httpContextAccessor)
    {
        var context = httpContextAccessor.HttpContext;
        if (context is null)
            return null;

        if (context.Request.Headers.TryGetValue(HeaderName, out var headerValue)
            && !string.IsNullOrWhiteSpace(headerValue))
        {
            return headerValue.ToString().Trim();
        }

        if (context.Request.Query.TryGetValue(QueryParameterName, out var queryValue)
            && !string.IsNullOrWhiteSpace(queryValue))
        {
            return queryValue.ToString().Trim();
        }

        return null;
    }
}
