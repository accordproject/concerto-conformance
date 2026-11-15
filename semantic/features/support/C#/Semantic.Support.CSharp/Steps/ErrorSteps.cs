using Concerto.Conformance.Runtimes;
using NUnit.Framework;
using Reqnroll;

namespace Concerto.Conformance.Steps;

/// <summary>
/// The error assertions, shared by the semantic and the instance suites. They
/// assert an error class, a name from the model, or an <c>errorType</c> code;
/// only the legacy message step looks at message text.
/// </summary>
[Binding]
public sealed class ErrorSteps(ConformanceWorld world)
{
    [Then("no error should be thrown")]
    public void NoError() =>
        Assert.That(world.Error, Is.Null, $"Expected no error, but got: {world.Error?.Message}");

    [Then("an error should be thrown with message {string}")]
    public void ErrorWithMessage(string expected)
    {
        var error = Require("an error to be thrown");
        var regex = MessageMatcher.AsRegex(expected);
        Assert.That(MessageMatcher.Matches(expected, error.Message),
            regex is null
                ? $"Expected error to include \"{expected}\", but got: \"{error.Message}\""
                : $"Expected error to match regex {expected}, but got: \"{error.Message}\"");
    }

    // Rejection at the 'rejected' level, for rules where the implementations
    // do not share an error class yet.
    [Then("an error should be thrown")]
    public void AnyError() => Require("an error to be thrown");

    [Then("an error of class {string} should be thrown")]
    public void ErrorOfClass(string expected)
    {
        var error = Require($"an error of class {expected}");
        Assert.That(error.ErrorClass, Is.EqualTo(expected),
            $"Expected an error of class {expected}, but got {error.ErrorClass}: \"{error.Message}\"");
    }

    // Only for names that come from the model or the instance (a type,
    // property or namespace), never for message prose.
    [Then("the error should mention {string}")]
    public void ErrorMentions(string name)
    {
        var error = Require($"an error mentioning \"{name}\"");
        Assert.That(error.Message.Contains(name, StringComparison.Ordinal),
            $"Expected the error to mention \"{name}\", but got: \"{error.Message}\"");
    }

    [Then("the error type should be {string}")]
    public void ErrorType(string expected)
    {
        var error = Require($"an error of type {expected}");
        var actual = error.ErrorTypeOrUnsupported(Hooks.Runtime.Name);
        Assert.That(actual, Is.EqualTo(expected),
            $"Expected an error of type {expected}, but got {actual ?? "none"}: \"{error.Message}\"");
    }

    private RuntimeError Require(string what) =>
        world.Error ?? throw new AssertionException($"Expected {what}, but none was thrown");
}
