using Concerto.Conformance.Runtimes;
using NUnit.Framework;
using Reqnroll;

namespace Concerto.Conformance.Steps;

/// <summary>
/// The instance suite's steps (<c>validate/features/*.feature</c>), matching
/// <c>validate/validateSteps.js</c>. Paths are relative to the repository root.
/// </summary>
[Binding]
public sealed class InstanceSteps(ConformanceWorld world)
{
    private static readonly IReadOnlyDictionary<string, object> NoOptions = new Dictionary<string, object>();

    [When("I validate {string} with models {string}")]
    public void Validate(string jsonPath, string modelPath) => Run(jsonPath, modelPath, NoOptions);

    [When("I validate {string} with models {string} and options:")]
    public void ValidateWithOptions(string jsonPath, string modelPath, DataTable table) =>
        Run(jsonPath, modelPath, OptionTable.SerializerOptions(table));

    [Then("the validation should succeed")]
    public void ShouldSucceed()
    {
        Assert.That(world.InstanceValidated, "Expected success, but the validation did not run");
        Assert.That(world.Error, Is.Null, $"Expected success but got error: {world.Error?.Message}");
    }

    [Then("the validation should fail")]
    public void ShouldFail()
    {
        Assert.That(world.InstanceValidated, "Expected failure, but the validation did not run");
        Assert.That(world.Error, Is.Not.Null, "Expected failure but validation succeeded");
    }

    [Then("the error message should contain {string}")]
    public void MessageShouldContain(string expected)
    {
        var message = world.Error?.Message ?? "";
        Assert.That(message.Contains(expected, StringComparison.Ordinal),
            $"Expected error to contain \"{expected}\", but got \"{message}\"");
    }

    private void Run(string jsonPath, string modelPath, IReadOnlyDictionary<string, object> options)
    {
        var instance = Fixtures.ReadJson(Paths.Root, jsonPath);
        var model = new InstanceModel(
            Fixtures.ExistingFile(Paths.Root, modelPath),
            () => Fixtures.AstSibling(Paths.Root, modelPath));
        world.InstanceValidated = true;
        try
        {
            Hooks.Runtime.ValidateInstance(model, instance, options);
            world.Error = null;
        }
        catch (RuntimeError e)
        {
            world.Error = e;
        }
    }
}
