using Concerto.Conformance.Runtimes;
using NUnit.Framework;
using Reqnroll;

namespace Concerto.Conformance.Steps;

[Binding]
public sealed class Hooks
{
    /// <summary>Set to run scenarios tagged <c>@skip-csharp</c> as well.</summary>
    public const string IncludeSkipCSharp = "CONFORMANCE_INCLUDE_SKIP_CSHARP";

    private static IConcertoRuntime? runtime;

    /// <summary>The runtime under test, shared by the whole run.</summary>
    public static IConcertoRuntime Runtime =>
        runtime ?? throw new InvalidOperationException("harness error: the runtime is not started");

    [BeforeTestRun]
    public static void StartRuntime()
    {
        runtime = RuntimeRegistry.Create();
        TestContext.Progress.WriteLine($"Concerto conformance: runtime '{runtime.Name}'");
    }

    [AfterTestRun]
    public static void StopRuntime()
    {
        runtime?.Dispose();
        runtime = null;
    }

    /// <summary>
    /// <c>@skip</c> is skipped by every runner. <c>@skip-csharp</c> marks a
    /// scenario this runner cannot run yet; <c>@skip-rust</c> does not apply here.
    /// </summary>
    [BeforeScenario(Order = 0)]
    public static void SkipTagged(ScenarioContext scenario)
    {
        var tags = scenario.ScenarioInfo.CombinedTags;
        if (tags.Contains("skip"))
        {
            Assert.Ignore("upstream @skip tag");
        }
        if (tags.Contains("skip-csharp") && Environment.GetEnvironmentVariable(IncludeSkipCSharp) is null)
        {
            Assert.Ignore("tagged @skip-csharp");
        }
    }
}
