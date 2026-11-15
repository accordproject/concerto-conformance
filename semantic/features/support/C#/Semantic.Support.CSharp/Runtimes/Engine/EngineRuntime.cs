#if CONCERTO_ENGINE
using AccordProject.Concerto.Engine;
using EngineModelManager = AccordProject.Concerto.Engine.ModelManager;

namespace Concerto.Conformance.Runtimes.Engine;

/// <summary>
/// concerto-dotnet's <c>AccordProject.Concerto.Engine</c>: the .NET binding over
/// the concerto-rust engine (accordproject/concerto-dotnet#58), in process.
/// </summary>
/// <remarks>
/// How the binding's surface maps onto the steps:
/// <list type="bullet">
/// <item><c>AddModels</c> loads a batch in any import order and validates the
/// whole set, keeping none of it on error. There is no unvalidated add, so both
/// load steps validate, and <c>When I validate the models</c> has nothing left
/// to do. A scenario's outcome is the same: the JavaScript harness skips
/// validation once a load has failed.</item>
/// <item>The binding takes no model manager options and no serializer
/// options, and its errors carry a message-catalogue code rather than an
/// <c>errorType</c>. Scenarios that need those fail with
/// <see cref="UnsupportedByRuntimeException"/>, naming the gap.</item>
/// <item>Error kinds map to the TypeScript class names:
/// <c>IllegalModel</c> to <c>IllegalModelException</c>, and so on. Kinds with
/// no TypeScript counterpart keep their name; <c>Internal</c> is a failure of
/// the binding itself, never an expected error.</item>
/// </list>
/// </remarks>
public sealed class EngineRuntime : IConcertoRuntime
{
    public const string RuntimeName = "engine";

    public string Name => RuntimeName;

    public IModelSession CreateSession(IReadOnlyDictionary<string, object> options)
    {
        RequireNoOptions(options, "model manager options");
        return new Session();
    }

    public void ValidateInstance(InstanceModel model, string instanceJson, IReadOnlyDictionary<string, object> options)
    {
        RequireNoOptions(options, "serializer options");
        var ast = model.ReadAst();
        using var manager = new EngineModelManager();
        Translate(() =>
        {
            manager.AddModels(ast);
            manager.ValidateOrThrow(instanceJson);
        });
    }

    public void Dispose()
    {
    }

    private static void RequireNoOptions(IReadOnlyDictionary<string, object> options, string what)
    {
        if (options.Count > 0)
        {
            throw new UnsupportedByRuntimeException(RuntimeName, $"{what} ({string.Join(", ", options.Keys)})");
        }
    }

    private static void Translate(Action body)
    {
        try
        {
            body();
        }
        catch (ConcertoException e) when (e.Kind == "Internal")
        {
            throw new InvalidOperationException($"harness error: the engine binding failed: [{e.Code}] {e.Message}", e);
        }
        catch (ConcertoException e)
        {
            throw new RuntimeError(ErrorClass(e.Kind), e.Message, errorType: null)
            {
                ErrorTypeUnsupportedReason = $"errorType (the binding reports the catalogue code '{e.Code}')",
            };
        }
    }

    private static string ErrorClass(string kind) => kind switch
    {
        "IllegalModel" => "IllegalModelException",
        "TypeNotFound" => "TypeNotFoundException",
        "Validation" => "ValidationException",
        "Metamodel" => "MetamodelException",
        _ => kind,
    };

    private sealed class Session : IModelSession
    {
        private readonly EngineModelManager manager = new();

        public void AddModels(IReadOnlyList<ModelAst> models, bool validate) =>
            Translate(() => manager.AddModels(models.Select(m => m.Json)));

        public void ValidateModels()
        {
            // AddModels already validated the whole model set.
        }

        public void Dispose() => manager.Dispose();
    }
}
#endif
