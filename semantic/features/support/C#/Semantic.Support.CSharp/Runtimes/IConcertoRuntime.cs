namespace Concerto.Conformance.Runtimes;

/// <summary>
/// A Concerto implementation under test. The steps only talk to a runtime
/// through this interface, so the same feature files can run against any
/// .NET-reachable implementation (see <see cref="RuntimeRegistry"/>).
/// </summary>
/// <remarks>
/// A runtime reports what the implementation did by throwing
/// <see cref="RuntimeError"/>. Anything else it throws is a harness failure:
/// it fails the step and never satisfies an error expectation. A feature the
/// runtime cannot express (an option, an error type) is reported with
/// <see cref="UnsupportedByRuntimeException"/>, so a gap in a runtime's
/// surface shows up as a failure that names the gap, never as a pass.
/// </remarks>
public interface IConcertoRuntime : IDisposable
{
    /// <summary>The name selected with <c>CONCERTO_RUNTIME</c>.</summary>
    string Name { get; }

    /// <summary>
    /// A model manager built with <paramref name="options"/>, as
    /// <c>new ModelManager(options)</c>. The options are the
    /// <c>the model manager options:</c> table, dotted names already nested.
    /// </summary>
    IModelSession CreateSession(IReadOnlyDictionary<string, object> options);

    /// <summary>
    /// Loads the model at <paramref name="model"/> into a fresh manager and
    /// validates <paramref name="instanceJson"/> against it, as
    /// <c>Serializer.fromJSON</c> followed by <c>toJSON</c>.
    /// </summary>
    void ValidateInstance(InstanceModel model, string instanceJson, IReadOnlyDictionary<string, object> options);
}

/// <summary>One scenario's model manager.</summary>
public interface IModelSession : IDisposable
{
    /// <summary>
    /// Adds the models of one load step, in table order, stopping at the
    /// first that fails. <paramref name="validate"/> false is
    /// <c>addModelFile(file, null, name, true)</c> (checked later by
    /// <see cref="ValidateModels"/>); true checks each model as it is added,
    /// the only path that runs metamodel validation.
    /// </summary>
    void AddModels(IReadOnlyList<ModelAst> models, bool validate);

    /// <summary><c>validateModelFiles()</c>.</summary>
    void ValidateModels();
}

/// <summary>A model fixture: its JSON AST and the file name it is loaded as.</summary>
public sealed record ModelAst(string FileName, string Json);

/// <summary>
/// The model of an instance scenario, given as a <c>.cto</c> path. Runtimes
/// that cannot parse CTO read the JSON AST next to it with <see cref="ReadAst"/>.
/// </summary>
public sealed record InstanceModel(string CtoPath, Func<string> ReadAst);

/// <summary>An error raised by the implementation under test.</summary>
public sealed class RuntimeError : Exception
{
    public RuntimeError(string errorClass, string message, string? errorType)
        : base(message)
    {
        ErrorClass = errorClass;
        ErrorType = errorType;
    }

    /// <summary>
    /// The cross-implementation exception class, e.g.
    /// <c>IllegalModelException</c> or <c>ValidationException</c>.
    /// </summary>
    public string ErrorClass { get; }

    /// <summary>
    /// The <c>errorType</c> code (<c>DefaultValidatorException</c>, ...), or
    /// null when the error has none. A runtime that cannot report error
    /// types at all throws <see cref="UnsupportedByRuntimeException"/> from
    /// <see cref="ErrorTypeOrUnsupported"/> instead.
    /// </summary>
    public string? ErrorType { get; }

    /// <summary>Set by a runtime whose errors never carry an error type.</summary>
    public string? ErrorTypeUnsupportedReason { get; init; }

    public string? ErrorTypeOrUnsupported(string runtime) =>
        ErrorTypeUnsupportedReason is null
            ? ErrorType
            : throw new UnsupportedByRuntimeException(runtime, ErrorTypeUnsupportedReason);
}

/// <summary>A scenario needs something the selected runtime cannot do.</summary>
public sealed class UnsupportedByRuntimeException(string runtime, string what)
    : Exception($"runtime '{runtime}' does not support {what}");
