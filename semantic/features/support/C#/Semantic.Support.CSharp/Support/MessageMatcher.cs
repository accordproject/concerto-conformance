using System.Text.RegularExpressions;

namespace Concerto.Conformance;

/// <summary>
/// <c>an error should be thrown with message "..."</c>: a substring, or a
/// regular expression written <c>/pattern/flags</c>, as in the JavaScript
/// harness (<c>/^\/(.+)\/([gimsuy]*)?$/</c>). The <c>i</c>, <c>m</c> and
/// <c>s</c> flags apply; <c>g</c>, <c>u</c> and <c>y</c> do not change whether
/// a match exists.
/// </summary>
public static partial class MessageMatcher
{
    [GeneratedRegex("^/(.+)/([gimsuy]*)$", RegexOptions.Singleline)]
    private static partial Regex Delimited();

    public static bool Matches(string expected, string actual)
    {
        var regex = AsRegex(expected);
        return regex is null ? actual.Contains(expected, StringComparison.Ordinal) : regex.IsMatch(actual);
    }

    /// <summary>The expectation as a regex, or null when it is a plain substring.</summary>
    public static Regex? AsRegex(string expected)
    {
        var match = Delimited().Match(expected);
        if (!match.Success)
        {
            return null;
        }
        var options = RegexOptions.None;
        foreach (var flag in match.Groups[2].Value)
        {
            options |= flag switch
            {
                'i' => RegexOptions.IgnoreCase,
                'm' => RegexOptions.Multiline,
                's' => RegexOptions.Singleline,
                _ => RegexOptions.None,
            };
        }
        try
        {
            return new Regex(match.Groups[1].Value, options);
        }
        catch (ArgumentException e)
        {
            throw new InvalidOperationException($"harness error: invalid expectation {expected}: {e.Message}");
        }
    }
}
