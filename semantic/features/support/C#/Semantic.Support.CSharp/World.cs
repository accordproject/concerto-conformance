using Reqnroll;
using AccordProject.Concerto.Core;

namespace Semantic.Support.CSharp
{
    public class CustomWorld
    {
        public ModelManager ModelManager { get; set; }
        public Exception Error { get; set; }

        public CustomWorld()
        {
            ModelManager = new ModelManager(new ModelManagerOptions { EnableMapType = true });
            Error = null;
        }
    }

    [Binding]
    public class WorldSetup
    {
        private readonly ScenarioContext _scenarioContext;

        public WorldSetup(ScenarioContext scenarioContext)
        {
            _scenarioContext = scenarioContext;
            _scenarioContext.Set(new CustomWorld());
        }
    }
}
