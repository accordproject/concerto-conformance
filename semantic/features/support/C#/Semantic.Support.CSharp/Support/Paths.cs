using System.Reflection;

namespace Concerto.Conformance;

/// <summary>
/// Locations in this repository, fixed at build time so the run does not
/// depend on its working directory.
/// </summary>
public static class Paths
{
    public static string Root { get; } =
        typeof(Paths).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .Single(a => a.Key == "ConformanceRoot").Value
        ?? throw new InvalidOperationException("ConformanceRoot is not set");

    /// <summary><c>semantic/specifications</c>: the semantic model_file paths are relative to it.</summary>
    public static string Specifications { get; } = Path.Combine(Root, "semantic", "specifications");
}
