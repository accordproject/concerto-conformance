using Concerto.Conformance.Runtimes.Reference;

namespace Concerto.Conformance.Runtimes;

/// <summary>
/// Picks the runtime under test from <c>CONCERTO_RUNTIME</c>:
/// <list type="bullet">
/// <item><c>reference</c> (default): concerto-core from this repository's
/// <c>node_modules</c>, through a Node.js bridge. It checks the harness itself:
/// it must give the same results as <c>npm test</c>.</item>
/// <item><c>engine</c>: concerto-dotnet's <c>AccordProject.Concerto.Engine</c>,
/// the .NET binding over concerto-rust. Only available when built with
/// <c>-p:ConcertoEngineProject=...</c>.</item>
/// </list>
/// </summary>
public static class RuntimeRegistry
{
    public const string Variable = "CONCERTO_RUNTIME";

    public static IConcertoRuntime Create()
    {
        var name = Environment.GetEnvironmentVariable(Variable);
        name = string.IsNullOrWhiteSpace(name) ? ReferenceRuntime.RuntimeName : name.Trim();
        return name switch
        {
            ReferenceRuntime.RuntimeName => new ReferenceRuntime(Paths.Root),
#if CONCERTO_ENGINE
            Engine.EngineRuntime.RuntimeName => new Engine.EngineRuntime(),
#else
            "engine" => throw new InvalidOperationException(
                "The engine runtime is not compiled in: build with " +
                "-p:ConcertoEngineProject=/path/to/AccordProject.Concerto.Engine.csproj"),
#endif
            _ => throw new InvalidOperationException($"Unknown {Variable} '{name}'. Known: reference, engine."),
        };
    }
}
