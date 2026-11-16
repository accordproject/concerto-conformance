# C# conformance runner

Runs the semantic features (`semantic/features/*.feature`) and the instance
features (`validate/features/*.feature`) with
[Reqnroll](https://reqnroll.net) on .NET 8. The feature files are linked in
place, not copied, so they are the same files the JavaScript and Rust runners
use.

From the repository root:

```sh
npm install          # the reference runtime is this repository's concerto-core
npm run test:csharp  # = dotnet test "semantic/features/support/C#/Semantic.Support.CSharp"
```

Fixture paths are fixed at build time, so `dotnet test` can be run from any
directory.

## Choosing the runtime to test

The steps never call an implementation directly. They go through
`IConcertoRuntime` (`Runtimes/IConcertoRuntime.cs`), and `CONCERTO_RUNTIME`
picks the implementation:

| `CONCERTO_RUNTIME` | Implementation |
|---|---|
| `reference` (default) | `@accordproject/concerto-core` from `node_modules`, through one long-lived Node.js process (`Runtimes/Reference/reference-bridge.mjs`). It makes the same calls as the JavaScript runner, so it checks this runner itself: the results must be the same as `npm test`'s. `CONCERTO_NODE` picks the `node` executable. |
| `engine` | concerto-dotnet's `AccordProject.Concerto.Engine`, the .NET binding over concerto-rust ([concerto-dotnet#58](https://github.com/accordproject/concerto-dotnet/pull/58)). It is compiled in only when you give its project, see below. |

```sh
CONCERTO_RUNTIME=engine dotnet test "semantic/features/support/C#/Semantic.Support.CSharp" \
  -p:ConcertoEngineProject=/path/to/concerto-dotnet/AccordProject.Concerto.Engine/AccordProject.Concerto.Engine.csproj
```

To add a runtime, implement `IConcertoRuntime` and register its name in
`Runtimes/RuntimeRegistry.cs`. A runtime reports what the implementation did
by throwing `RuntimeError`, with the TypeScript class name of the error (for
example `IllegalModelException`) and its `errorType`. If a scenario needs
something the runtime cannot express, such as an option or an error type, the
runtime throws `UnsupportedByRuntimeException`. The scenario then fails and
names the gap. It never passes.

### The `engine` runtime

The binding's surface differs from concerto-core's in three ways:

- `AddModels` loads a batch in any import order and validates the whole set.
  There is no unvalidated add, so both load steps validate, and
  `When I validate the models` has nothing left to do. A scenario's outcome is
  the same, because the JavaScript runner skips validation once a load has
  failed.
- It has no model manager options and no serializer options. The scenarios
  that use `the model manager options:` fail as unsupported.
- Its errors carry a message-catalogue code, not an `errorType`. The scenarios
  that use `the error type should be` fail as unsupported.

Error kinds map to class names: `IllegalModel` maps to
`IllegalModelException`, `TypeNotFound` to `TypeNotFoundException`,
`Validation` to `ValidationException` and `Metamodel` to
`MetamodelException`. Other kinds keep their own name. `Internal` is a failure
of the binding itself and fails the step.

The engine does not parse CTO. For an instance scenario it loads the
`.ast.json` file next to the scenario's `.cto` model (`npm run convert-ast`).
A model without one fails as a missing fixture.

## Results

| Result | Meaning |
|---|---|
| Passed | The scenario passed. |
| Failed | The runtime did not do what the scenario expects, a fixture is missing or is not JSON (`FixtureException`), the runtime does not support something the scenario needs, or the runner itself failed (`harness error: ...`). |
| Skipped | Tagged `@skip` (every runner skips these) or `@skip-csharp`. Set `CONFORMANCE_INCLUDE_SKIP_CSHARP=1` to run `@skip-csharp` scenarios too. `@skip-rust` does not apply here. |

The steps match the JavaScript runner's (`semantic/features/support/Javascript/steps.ts`
and `validate/validateSteps.js`):

- A fixture that cannot be read fails the step. It is never taken as the
  error a scenario expects.
- `When I validate the models` does nothing once a load has failed, so the
  load error is the one asserted.
- `an error should be thrown with message "..."` matches a substring, or a
  regular expression written `/pattern/flags`. The `i`, `m` and `s` flags
  apply; `g`, `u` and `y` are accepted and have no effect.
- In option tables, `true` and `false` are booleans, numbers are numbers, and
  a dotted name sets a nested option.

`dotnet test --filter "TestCategory=harness"` runs only the runner's own unit
tests: message matching, option tables and fixtures.

## Writing feature files

Reqnroll turns every scenario into a test method. It rejects a feature file
in which two scenarios have the same name. cucumber-js and the Rust runner
accept duplicate names, so this runner is the one that catches them.
