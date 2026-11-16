using Concerto.Conformance.Runtimes;

namespace Concerto.Conformance.Steps;

/// <summary>
/// One scenario's state. Reqnroll creates it per scenario and disposes it
/// after, so nothing leaks from one scenario into the next.
/// </summary>
public sealed class ConformanceWorld : IDisposable
{
    /// <summary>The model manager of a semantic scenario, once created.</summary>
    public IModelSession? Session { get; set; }

    /// <summary>The error the runtime raised while loading, validating or deserialising.</summary>
    public RuntimeError? Error { get; set; }

    /// <summary>Whether an instance scenario's validation step ran.</summary>
    public bool InstanceValidated { get; set; }

    public void Dispose() => Session?.Dispose();
}
