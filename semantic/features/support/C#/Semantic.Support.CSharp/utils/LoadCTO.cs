using System.IO;

namespace Semantic.Support.CSharp.Utils
{
    public static class LoadCTO
    {
        public static string Load(string relativePath)
        {
            var basePath = Path.Combine("semantic", "specifications");
            var fullPath = Path.Combine(basePath, relativePath);
            return File.ReadAllText(fullPath);
        }
    }
}
