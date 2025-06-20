using System;
using Reqnroll;
using Semantic.Support.CSharp.Utils;
using AccordProject.Concerto.Parser;
using AccordProject.Concerto.Core;
using FluentAssertions;

namespace Semantic.Support.CSharp
{
    [Binding]
    public class Steps
    {
        private readonly ScenarioContext _context;
        private CustomWorld World => _context.Get<CustomWorld>();

        public Steps(ScenarioContext context)
        {
            _context = context;
        }

        [Given(@"I load the following models:")]
        public void GivenILoadTheFollowingModels(Table table)
        {
            foreach (var row in table.Rows)
            {
                var modelContent = LoadCTO.Load(row["model_file"]);
                try
                {
                    var ast = Parser.Parse(modelContent, row["model_file"]);
                    var modelFile = new ModelFile(World.ModelManager, ast, modelContent, row["model_file"]);
                    World.ModelManager.AddModelFile(modelFile, null, modelFile.GetName(), true);
                }
                catch (Exception ex)
                {
                    World.Error = ex;
                    break;
                }
            }
        }

        [When(@"I validate the models")]
        public void WhenIValidateTheModels()
        {
            try
            {
                World.ModelManager.ValidateModelFiles();
                World.Error = null;
            }
            catch (Exception ex)
            {
                World.Error = ex;
            }
        }

        [Then(@"an error should be thrown with message ""(.*)""")]
        public void ThenAnErrorShouldBeThrownWithMessage(string expected)
        {
            World.Error.Should().NotBeNull("Expected an error to be thrown");

            if (expected.StartsWith("/") && expected.EndsWith("/"))
            {
                var regex = new System.Text.RegularExpressions.Regex(expected.Trim('/'));
                regex.IsMatch(World.Error.Message).Should().BeTrue(
                    $"Expected error to match regex {regex}, but got: \"{World.Error.Message}\""
                );
            }
            else
            {
                World.Error.Message.Should().Contain(expected);
            }
        }

        [Then(@"no error should be thrown")]
        public void ThenNoErrorShouldBeThrown()
        {
            World.Error.Should().BeNull($"Expected no error, but got: {World.Error?.Message}");
        }
    }
}
