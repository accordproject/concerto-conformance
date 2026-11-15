using NUnit.Framework;
using Reqnroll;

namespace Concerto.Conformance.HarnessTests;

/// <summary>The harness's own rules, the same cases as the Rust harness's unit tests.</summary>
[TestFixture]
[Category("harness")]
public class MessageMatcherTests
{
    [Test]
    public void PlainExpectationIsACaseSensitiveSubstring()
    {
        Assert.That(MessageMatcher.Matches("Duplicate", "Duplicate class name Foo"));
        Assert.That(MessageMatcher.Matches("duplicate", "Duplicate class name Foo"), Is.False);
        Assert.That(MessageMatcher.Matches("", "anything"));
    }

    [Test]
    public void SlashDelimitedExpectationIsARegex()
    {
        Assert.That(MessageMatcher.Matches("/Import from .* exists/", "Import from ns already exists"));
        Assert.That(MessageMatcher.Matches("/^exists/", "Import from ns already exists"), Is.False);
        Assert.That(MessageMatcher.Matches("/IMPORT/i", "import"));
    }

    [Test]
    public void FlagsThatDoNotChangeWhetherAMatchExistsAreAccepted() =>
        Assert.That(MessageMatcher.Matches("/a.c/gu", "abc"));

    [Test]
    public void StraySlashesAreLiteral()
    {
        Assert.That(MessageMatcher.Matches("a/b", "path a/b here"));
        Assert.That(MessageMatcher.Matches("/usr/bin", "in /usr/bin"));
    }

    [Test]
    public void AnInvalidRegexIsAHarnessError() =>
        Assert.Throws<InvalidOperationException>(new Action(() => MessageMatcher.Matches("/(/", "x")));
}

[TestFixture]
[Category("harness")]
public class OptionTableTests
{
    [Test]
    public void CellsAreReadAsTheJavaScriptHarnessReadsThem()
    {
        Assert.That(OptionTable.Value(" true "), Is.EqualTo(true));
        Assert.That(OptionTable.Value("false"), Is.EqualTo(false));
        Assert.That(OptionTable.Value("3"), Is.EqualTo(3d));
        Assert.That(OptionTable.Value("error"), Is.EqualTo("error"));
        Assert.That(OptionTable.Value("NaN"), Is.EqualTo("NaN"));
        Assert.That(OptionTable.Value(""), Is.EqualTo(""));
    }

    [Test]
    public void DottedOptionNamesNest()
    {
        var table = new DataTable("option", "value");
        table.AddRow("decoratorValidation.missingDecorator", "error");
        table.AddRow("decoratorValidation.invalidDecorator", "warning");
        table.AddRow("metamodelValidation", "true");

        var options = OptionTable.ModelManagerOptions(table);

        Assert.That(options["metamodelValidation"], Is.EqualTo(true));
        var decorators = (IReadOnlyDictionary<string, object>)options["decoratorValidation"];
        Assert.That(decorators["missingDecorator"], Is.EqualTo("error"));
        Assert.That(decorators["invalidDecorator"], Is.EqualTo("warning"));
    }

    [Test]
    public void AnOptionCannotBeBothAValueAndAGroup()
    {
        var table = new DataTable("option", "value");
        table.AddRow("strict", "true");
        table.AddRow("strict.mode", "on");
        Assert.Throws<InvalidOperationException>(new Action(() => OptionTable.ModelManagerOptions(table)));
    }

    [Test]
    public void SerializerOptionsReadEveryRowAsAKeyValuePair()
    {
        var table = new DataTable("utcOffset", "60");
        table.AddRow("strict", "true");

        var options = OptionTable.SerializerOptions(table);

        Assert.That(options["utcOffset"], Is.EqualTo(60d));
        Assert.That(options["strict"], Is.EqualTo("true"));
    }
}

[TestFixture]
[Category("harness")]
public class FixtureTests
{
    [Test]
    public void AMissingFixtureIsAHarnessError() =>
        Assert.Throws<FixtureException>(new Action(() => Fixtures.ReadJson(Paths.Specifications, "no/such/fixture.json")));

    [Test]
    public void ACtoModelResolvesToItsAstSibling()
    {
        var ast = Fixtures.AstSibling(Paths.Root, "validate/models/maps/maps.cto");
        Assert.That(ast, Does.Contain("concerto.metamodel@1.0.0.Model"));
    }
}
