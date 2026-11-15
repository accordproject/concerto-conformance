using System.Text.Json;

namespace Concerto.Conformance;

/// <summary>
/// A fixture cannot be read or is not valid JSON. This is a problem with the
/// suite, not with the runtime under test, so it fails the step itself and
/// never counts as the error a scenario expects.
/// </summary>
public sealed class FixtureException(string message) : Exception(message);

public static class Fixtures
{
    /// <summary>
    /// Reads <paramref name="relativePath"/> under <paramref name="baseDir"/>
    /// and checks that it is JSON. Returns the text unchanged.
    /// </summary>
    public static string ReadJson(string baseDir, string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(baseDir, relativePath));
        if (!File.Exists(full))
        {
            throw new FixtureException($"cannot read fixture {relativePath}: not found at {full}");
        }
        var text = File.ReadAllText(full);
        try
        {
            using var _ = JsonDocument.Parse(text);
        }
        catch (JsonException e)
        {
            throw new FixtureException($"cannot parse fixture {relativePath}: {e.Message}");
        }
        return text;
    }

    /// <summary>The full path of an existing file, or a <see cref="FixtureException"/>.</summary>
    public static string ExistingFile(string baseDir, string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(baseDir, relativePath));
        return File.Exists(full)
            ? full
            : throw new FixtureException($"cannot read fixture {relativePath}: not found at {full}");
    }

    /// <summary>
    /// The JSON AST of a <c>.cto</c> model: the <c>.ast.json</c> file next to it
    /// (<c>npm run convert-ast</c>), for runtimes that do not parse CTO.
    /// </summary>
    public static string AstSibling(string baseDir, string ctoRelativePath)
    {
        if (!ctoRelativePath.EndsWith(".cto", StringComparison.Ordinal))
        {
            throw new FixtureException($"model {ctoRelativePath} is not a .cto file");
        }
        return ReadJson(baseDir, ctoRelativePath[..^".cto".Length] + ".ast.json");
    }
}
