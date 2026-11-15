using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Concerto.Conformance.Runtimes.Reference;

/// <summary>
/// The reference implementation, concerto-core from this repository's
/// <c>node_modules</c> (<c>npm install</c>), run in one long-lived Node.js
/// process (<c>reference-bridge.mjs</c>). Set <c>CONCERTO_NODE</c> to choose
/// the <c>node</c> executable.
/// </summary>
public sealed class ReferenceRuntime : IConcertoRuntime
{
    public const string RuntimeName = "reference";
    private const string Frame = "\u0001concerto-bridge ";

    private readonly Process node;
    private readonly StringBuilder log = new();
    private readonly object gate = new();
    private int nextId;

    public ReferenceRuntime(string repositoryRoot)
    {
        var bridge = Path.Combine(AppContext.BaseDirectory, "Runtimes", "Reference", "reference-bridge.mjs");
        var start = new ProcessStartInfo(Environment.GetEnvironmentVariable("CONCERTO_NODE") ?? "node")
        {
            ArgumentList = { bridge, repositoryRoot },
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            StandardInputEncoding = new UTF8Encoding(false),
            StandardOutputEncoding = Encoding.UTF8,
        };
        node = Process.Start(start) ?? throw new InvalidOperationException("harness error: cannot start node");
        node.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                lock (log) log.AppendLine(e.Data);
            }
        };
        node.BeginErrorReadLine();
    }

    public string Name => RuntimeName;

    public IModelSession CreateSession(IReadOnlyDictionary<string, object> options) =>
        new Session(this, Call("session.create", new JsonObject { ["options"] = ToJson(options) })!.GetValue<int>());

    public void ValidateInstance(InstanceModel model, string instanceJson, IReadOnlyDictionary<string, object> options) =>
        Call("instance.validate", new JsonObject
        {
            ["cto"] = model.CtoPath,
            ["instance"] = instanceJson,
            ["options"] = ToJson(options),
        });

    public void Dispose()
    {
        try
        {
            node.StandardInput.Close();
            if (!node.WaitForExit(5000))
            {
                node.Kill(entireProcessTree: true);
            }
        }
        catch (Exception e) when (e is InvalidOperationException or IOException)
        {
            // Already gone.
        }
        node.Dispose();
    }

    /// <summary>
    /// Sends one request and waits for its reply. A runtime error is thrown as
    /// <see cref="RuntimeError"/>; a broken bridge as a harness failure.
    /// </summary>
    private JsonNode? Call(string op, JsonObject request)
    {
        lock (gate)
        {
            var id = ++nextId;
            request["id"] = id;
            request["op"] = op;
            try
            {
                node.StandardInput.WriteLine(request.ToJsonString());
                node.StandardInput.Flush();
            }
            catch (IOException)
            {
                throw Broken("the bridge exited");
            }

            while (node.StandardOutput.ReadLine() is { } line)
            {
                if (!line.StartsWith(Frame, StringComparison.Ordinal))
                {
                    continue; // Not a reply: something wrote to stdout directly.
                }
                var reply = JsonNode.Parse(line[Frame.Length..])!.AsObject();
                if (reply["id"]?.GetValue<int>() != id)
                {
                    throw Broken($"reply for request {reply["id"]} while waiting for {id}");
                }
                if (reply["ok"]!.GetValue<bool>())
                {
                    return reply["value"];
                }
                if (reply["fatal"] is { } fatal)
                {
                    throw Broken(fatal.GetValue<string>());
                }
                var error = reply["error"]!;
                throw new RuntimeError(
                    error["class"]!.GetValue<string>(),
                    error["message"]!.GetValue<string>(),
                    error["errorType"]?.GetValue<string>());
            }
            throw Broken("the bridge exited");
        }
    }

    private InvalidOperationException Broken(string why)
    {
        string stderr;
        lock (log) stderr = log.ToString();
        return new InvalidOperationException($"harness error: reference bridge: {why}\n{stderr}");
    }

    private static JsonNode ToJson(IReadOnlyDictionary<string, object> options) =>
        JsonSerializer.SerializeToNode(options)!;

    private sealed class Session(ReferenceRuntime runtime, int id) : IModelSession
    {
        public void AddModels(IReadOnlyList<ModelAst> models, bool validate)
        {
            var array = new JsonArray();
            foreach (var model in models)
            {
                array.Add(new JsonObject { ["fileName"] = model.FileName, ["json"] = model.Json });
            }
            runtime.Call("session.add", new JsonObject { ["session"] = id, ["models"] = array, ["validate"] = validate });
        }

        public void ValidateModels() => runtime.Call("session.validate", new JsonObject { ["session"] = id });

        public void Dispose()
        {
            try
            {
                runtime.Call("session.dispose", new JsonObject { ["session"] = id });
            }
            catch (InvalidOperationException)
            {
                // The bridge is gone; there is nothing to free.
            }
        }
    }
}
