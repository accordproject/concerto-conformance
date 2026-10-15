# Engine adapters

An adapter connects the replay tools (`bin/replay.js`, and the fuzz harness
in `../fuzz`) to the engine under test. It is a CommonJS module that exports
`createAdapter()`:

```js
module.exports.createAdapter = () => ({
    name: 'my-engine',
    run(op, inputs) {
        // op:     "<Class>.<method>", "<Class>.new" or "<Holder>.<function>" (FORMAT.md)
        // inputs: the fixture's inputs with every blob resolved
        // return { outcome, window } or a promise of it, where
        //   outcome = { ok: <result> } | { error: { class, message, location, component } }
        //             plus `effects` when the op changed its receiver or a plain-data argument
        //   window  = { start, end }: wall-clock ms around the op itself (optional; used to
        //             recognise generated timestamps, see FORMAT.md "Canonicalisation")
    },
    close() {},   // optional: called once after the last fixture
});
```

Pass the module to the tools with `--engine <path>`.

## The contract

1. **Rebuild the inputs with public calls only.** Build a model manager from
   its constructor options and replay its recipe steps, or run its `derived`
   op. Build model files from `mfref` or `mfnew`, and so on. FORMAT.md
   ("Value encoding") defines every kind. `lib/codec.js` `makeDecoder` is the
   JS implementation.
2. **Run the op once**, and report its result or the exception it threw,
   encoded as FORMAT.md describes. For an op that returns a concerto object,
   report its summary: `ModelManager`, `ModelFile`, `Declaration` and so on.
3. **Report set-up failures by kind.** Throw an error whose `name` is
   `HarnessError` when the fixture cannot be set up for reasons of the
   fixture itself. That is reported as a harness error. Set
   `err.divergence = true` when the engine's own behaviour made set-up fail,
   for example a recipe step with another status than the recorded one. Set
   `err.unsupported = true` for an op the engine does not implement. Both
   count as failures. Any other error thrown while the inputs are rebuilt is
   also a failure ("input construction failed").
4. **Don't normalise.** Keys need not be sorted, and generated identifiers
   and timestamps need not be replaced. The judge canonicalises the outcome.
5. **Randomness.** Run each op under the seeded PRNG if your engine can (see
   FORMAT.md, "Randomness"). Otherwise compare `env.random` fixtures by
   structure, or skip them.
6. **Asynchronous ops.** Run the op inside `inputs.fs` and `inputs.net`, and
   report what it settles to.

The judge compares whether the call throws, the exception class, the
component, the location, values and effects. It does not compare message
text.

## For a JS build of concerto-core

You don't need a module: pass the build's package directory, the one that
holds its `package.json`, with the compiled modules under `dist/`:

```sh
node oracle/bin/replay.js --engine node_modules/@accordproject/concerto-core
```

[`examples/js-build-adapter.js`](examples/js-build-adapter.js) is the same
thing as a module, in about ten lines. It loads the build with
`lib/core.js` `loadPackage()` and wraps it with `lib/adapter.js`
`coreAdapter()`, which runs any 5.x or 6.x build through the public API the
corpus was recorded from. Start from it when your application wraps
concerto-core, for example to add a plugin, a model manager subclass or
default options.

## For an engine in another language

[`examples/process-adapter.js`](examples/process-adapter.js) runs your engine
as a separate process, which reads one JSON request per line and writes one
JSON reply per line:

```sh
ORACLE_ENGINE_CMD="./my-engine --oracle" \
  node oracle/bin/replay.js --engine oracle/examples/process-adapter.js
```

```
-> {"id": "0", "op": "ModelManager.addCTOModel", "inputs": {"target": {...}, "args": [...]}}
<- {"id": "0", "outcome": {"ok": {...}}}
<- {"id": "1", "unsupported": "ModelFile.getName"}
```

[`examples/reference-over-stdio.js`](examples/reference-over-stdio.js) is a
complete engine side, backed by the 5.0.0 reference. Use it to try the
protocol (all 16,242 fixtures pass through it). Set `ORACLE_ONLY_OPS` to see
how a partial engine is reported. Unsupported ops are counted as failures,
and the summary line counts them separately (`unsupported=`).

### Where to start

Not every fixture needs the JavaScript object model. Many fixtures need only
a model, an instance document or a decorator command set. You can start with
those and add the rest as your engine grows:

| Family | Ops | Fixtures | What the inputs are |
|---|---|---|---|
| Model documents | `ModelManager.addCTOModel`, `addModel`, `addModelFiles`, `addModelFile`, `updateModelFile`, `fromAst`, `validateModelFiles`, `validateModelFile`, `getAst`, `getModels`; `ModelFile.new`; `MetaModel.validateMetaModel`, `modelManagerFromMetaModel` | 2,629 | CTO text or a JSON metamodel AST, plus model manager options. The outcome is the load verdict (or exception class) and, for `getAst`/`getModels`, the AST |
| Instance documents | `Serializer.fromJSON`, `Serializer.toJSON`, `Resource.validate`, `Factory.newResource`, `newConcept`, `newRelationship`, `newTransaction`, `newEvent` | 5,433 | JSON instances (or a type name and options) against a model. The outcome is the validated instance, or the exception class |
| Decorator command sets | `DecoratorManager.*`, `DcsConverter.*` | 1,569 | a model and a decorator command set as JSON or YAML |
| JS API | the other 227 ops: introspection accessors (`ClassDeclaration.getProperty`, `Property.isArray`, ...), `Typed` and `Identifiable` accessors, `ModelUtil` and `DateTimeUtil` statics, `ModelLoader`, and the ops taking a `predicate`, `decoratorfactory`, `visitor` or `errnew` | 6,611 | handles from the JS object model. Implement them if your engine exposes the same API, otherwise report them `unsupported` |

All of these inputs are plain data. Even a model document fixture reaches its
model through a model manager recipe, which is a list of steps over CTO or
AST text. Use `--op` to replay one op at a time while you build an adapter.
Use `--report` for every failure and its first difference.

Engines that cannot parse CTO can look parsed ASTs up in the corpus's
`cto-cache/` (FORMAT.md).

## Checking an adapter

1. Replay the conformance source first:
   `node oracle/bin/replay.js --engine <yours> --source conformance`.
   It has 815 fixtures over 9 ops, mostly model loading and instances.
2. Replay everything with `--report report.json`. Group the failures in
   `report.json` by `op` and by the start of `detail`.
3. If your engine targets Concerto 6.x, add
   `--expected oracle/expected-6.0.0.tsv` (README.md).
4. Then fuzz it against the reference: `../fuzz/README.md`.
