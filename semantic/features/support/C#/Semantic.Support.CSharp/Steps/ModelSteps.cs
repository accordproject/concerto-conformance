using Concerto.Conformance.Runtimes;
using Reqnroll;

namespace Concerto.Conformance.Steps;

/// <summary>
/// The semantic suite's model steps (<c>semantic/features/*.feature</c>),
/// matching <c>semantic/features/support/Javascript/steps.ts</c>.
/// </summary>
[Binding]
public sealed class ModelSteps(ConformanceWorld world)
{
    private static readonly IReadOnlyDictionary<string, object> NoOptions = new Dictionary<string, object>();

    // Replaces the scenario's model manager with one built with these options.
    [Given("the model manager options:")]
    public void ModelManagerOptions(DataTable table)
    {
        if (world.Session is not null || world.Error is not null)
        {
            throw new InvalidOperationException(
                "harness error: the model manager options must come before any model is loaded");
        }
        world.Session = Hooks.Runtime.CreateSession(OptionTable.ModelManagerOptions(table));
    }

    [Given("I load the following models:")]
    public void LoadModels(DataTable table) => Load(table, validate: false);

    [Given("I load the following models with validation:")]
    public void LoadModelsWithValidation(DataTable table) => Load(table, validate: true);

    [When("I validate the models")]
    public void ValidateModels()
    {
        // A model that failed to load was never added, so validating the rest
        // would wrongly clear the load error.
        if (world.Error is not null)
        {
            return;
        }
        try
        {
            Session().ValidateModels();
        }
        catch (RuntimeError e)
        {
            world.Error = e;
        }
    }

    private void Load(DataTable table, bool validate)
    {
        if (!table.ContainsColumn("model_file"))
        {
            throw new InvalidOperationException("harness error: the step has no model_file column");
        }
        // Every fixture is read before anything is loaded: a fixture that
        // cannot be read must fail the step, never satisfy an expectation.
        var models = table.Rows
            .Select(row => row["model_file"].Trim())
            .Select(file => new ModelAst(file, Fixtures.ReadJson(Paths.Specifications, file)))
            .ToList();
        if (models.Count == 0)
        {
            throw new InvalidOperationException("harness error: the step has no model_file rows");
        }
        try
        {
            Session().AddModels(models, validate);
        }
        catch (RuntimeError e)
        {
            world.Error = e;
        }
    }

    private IModelSession Session() => world.Session ??= Hooks.Runtime.CreateSession(NoOptions);
}
