using System.Globalization;
using Reqnroll;

namespace Concerto.Conformance;

/// <summary>Option tables, read the way the JavaScript harness reads them.</summary>
public static class OptionTable
{
    /// <summary>
    /// <c>the model manager options:</c> (<c>option | value</c> columns). A dotted
    /// option name sets a nested field:
    /// <c>decoratorValidation.missingDecorator | error</c> gives
    /// <c>{ decoratorValidation: { missingDecorator: "error" } }</c>.
    /// </summary>
    public static IReadOnlyDictionary<string, object> ModelManagerOptions(DataTable table)
    {
        RequireColumns(table, "option", "value");
        var options = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var row in table.Rows)
        {
            var parts = row["option"].Trim().Split('.');
            var target = options;
            foreach (var part in parts[..^1])
            {
                if (!target.TryGetValue(part, out var child))
                {
                    child = new Dictionary<string, object>(StringComparer.Ordinal);
                    target[part] = child;
                }
                target = child as Dictionary<string, object>
                    ?? throw new InvalidOperationException($"harness error: option '{part}' is both a value and a group");
            }
            target[parts[^1]] = Value(row["value"]);
        }
        return options;
    }

    /// <summary>
    /// The options of <c>I validate ... with models ... and options:</c>, a
    /// two-column table read as <c>rowsHash()</c>: numeric values become numbers,
    /// anything else stays text.
    /// </summary>
    public static IReadOnlyDictionary<string, object> SerializerOptions(DataTable table)
    {
        var options = new Dictionary<string, object>(StringComparer.Ordinal);
        // rowsHash() treats the header row as data too.
        IEnumerable<IReadOnlyList<string>> rows =
            new[] { (IReadOnlyList<string>)table.Header.ToList() }
                .Concat(table.Rows.Select(r => (IReadOnlyList<string>)r.Values.ToList()));
        foreach (var row in rows)
        {
            if (row.Count != 2)
            {
                throw new InvalidOperationException("harness error: the options table must have two columns");
            }
            // `!isNaN(value)` then `Number(value)`: an empty cell is 0 here.
            var number = row[1].Trim().Length == 0 ? 0 : Number(row[1]);
            options[row[0]] = number is null ? row[1] : number.Value;
        }
        return options;
    }

    /// <summary>
    /// <c>true</c>/<c>false</c> as booleans, numbers as numbers, anything else
    /// as the trimmed text (<c>optionValue</c> in the JavaScript harness).
    /// </summary>
    public static object Value(string cell)
    {
        var text = cell.Trim();
        return text switch
        {
            "true" => true,
            "false" => false,
            _ => Number(text) is { } n ? n : text,
        };
    }

    /// <summary>
    /// JavaScript's <c>!isNaN(Number(text))</c> for a non-empty cell, as a double.
    /// Unlike JavaScript, .NET parses "NaN", so it is excluded here.
    /// </summary>
    private static double? Number(string text) =>
        text.Trim().Length > 0
        && double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var n)
        && !double.IsNaN(n)
            ? n
            : null;

    private static void RequireColumns(DataTable table, params string[] columns)
    {
        foreach (var column in columns)
        {
            if (!table.ContainsColumn(column))
            {
                throw new InvalidOperationException($"harness error: options table has no '{column}' column");
            }
        }
    }
}
