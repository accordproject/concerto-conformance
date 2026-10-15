# Fixture format

This describes what `lib/codec.js`, `lib/canon.js`, `lib/store.js`,
`lib/encodable.js` and `lib/ops.js` read and write. When this file and the
code disagree, the code is right.

## A fixture

`fixtures/<source>/<op>/<id>.json`:

```json
{
  "id": "0348844b174ac7163bd75789",
  "source": "unit",
  "source_test": "InstanceGenerator #visit should generate an id matching ...",
  "op": "ModelManager.addCTOModel",
  "inputs": { "target": <encoded receiver>, "args": [<encoded argument>, ...] },
  "outcome": { "ok": <encoded result> } | { "error": { "class", "message", "location", "component" } },
  "env": { "random": false },
  "occurrences": 1
}
```

| Field | Meaning |
|---|---|
| `id` | the first 24 hex digits of the sha256 of the recorded `{op, inputs, outcome, env}`, serialised with sorted keys; also the file name |
| `source` | what produced the call: `unit` (concerto-core 5.0.0's unit tests), `data` (its test data), `conformance` (this repository's scenarios), `gaps`, `lifted`, `supplement` (targeted inputs) |
| `source_test` | the test or scenario that made the call, for information |
| `op` | `<Class>.<method>`, `<Class>.new` for a constructor, or `<Holder>.<function>` for a static (see `lib/ops.js`) |
| `inputs.target` | the receiver, for a method op only |
| `inputs.args` | the arguments |
| `inputs.fs`, `inputs.net` | asynchronous ops only (below) |
| `outcome` | `{"ok": <result>}`, or `{"error": {...}}` for a call that threw |
| `outcome.effects` | optional: `{"target": <receiver after the call>}` for an op that changes an instance (`setPropertyValue`, `addArrayValue`, `setIdentifier`), and `{"args": {"<i>": <argument after the call>}}` when an op changed a plain-data argument in place |
| `env.random` | true when the op drew from `Math.random` (sample instance generation; see "Randomness") |
| `occurrences` | how many recorded calls had this exact content |

A `fileName` argument is never an absolute path. A file of this
repository's suite is named `<conformance>/<path>`, and one of
accordproject/concerto `<repo>/<path>`. The op never reads the file; the
name is only recorded, and returned by `ModelFile.getName()`.

`error.class` is the exception's constructor name (`IllegalModelException`,
`ValidationException`, `TypeError`, ...). `error.location` is its
`fileLocation` (or `null`), and `error.component` its `component` (or `null`).

Identical calls are stored once. The first source in the order unit, data,
conformance, gaps, lifted keeps the fixture.

## Canonicalisation

Outcomes are compared in canonical form (`lib/canon.js`):

1. Object keys are sorted. This applies to outcomes only. Inputs keep their
   order, which can be significant.
2. A version 4 UUID inside any string becomes `<uuid>`, unless that UUID
   occurs in the op's inputs, in which case it was supplied, not generated.
3. An ISO 8601 date-time inside any string becomes `<now>` when two things
   hold. Its instant lies inside the op's execution window (the wall-clock
   milliseconds measured around the call). And it is not the instant of any
   date-time in the inputs.

So a generated identifier or timestamp compares equal across engines, while
a supplied one is kept. Recorded outcomes are already canonical. An engine's
outcome is canonicalised by the judge, so adapters need not sort keys or
replace generated values.

**Error parity is class, not message.** The judge compares whether the call
throws, the exception class, the component, the location, every value and
the effects. It ignores `error.message`, and the `message` of any
`{"@@oracle":"throws"}` marker inside a value.

## Value encoding

Plain JSON stands for itself. Every other value is an object whose
`"@@oracle"` key names its kind.

### Scalars (inputs and outcomes)

| Kind | Shape | Value |
|---|---|---|
| `undefined` | `{}` | `undefined` |
| `number` | `{"value": "NaN" \| "Infinity" \| "-Infinity" \| "-0"}` | a number JSON cannot hold |
| `bigint` | `{"value": "<decimal>"}` | a BigInt |
| `date` | `{"iso": "<ISO 8601>" \| null}` | a JS `Date` (`null` for an invalid one) |
| `regexp` | `{"source", "flags"}` | a regular expression |
| `map` | `{"entries": [[<key>, <value>], ...]}` | a `Map` |
| `set` | `{"values": [...]}` | a `Set` |
| `dayjs` | `{"iso", "offset", "utc", "valid"}` | a dayjs instance (concerto's DateTime values) |
| `blob` | `{"sha256": "<hex>"}` | a large value in the blob store (below) |

### Handles (inputs)

Inputs that are objects of concerto-core are encoded as **recipes**: the
public calls that rebuild an equivalent object from plain data.

| Kind | Shape | Rebuilt as |
|---|---|---|
| `mm` | `{"id", "kind", "options", "steps"}` or `{"id", "kind", "derived": {"op", "inputs", "path"?}, "steps"}` | `new <kind>(options)` (`ModelManager`, `BaseModelManager` or `AstModelManager`), then each step in order; or the result of running the `derived` op (at `path` inside it) |
| `mmref` | `{"id"}` | the model manager with that `id` in the same inputs |
| `self` | `{}` | inside a step: the model manager the step runs on |
| `mfref` | `{"mm", "ns"}` | the model file of namespace `ns` registered in model manager `mm` |
| `mfnew` | `{"mm", "ast", "definitions", "fileName"}` | `new ModelFile(mm, ast, definitions, fileName)`, not registered |
| `declref` | `{"mf", "index", "name"}` | the declaration at `index` in `mf.getAllDeclarations()` |
| `declnew` | `{"cls", "mf", "ast"}` | a declaration built by a recorded constructor op and not part of its file: `new ScalarDeclaration(mf, ast)` |
| `propref` | `{"decl", "index", "name"}` or `{"decl", "part": "key" \| "value"}` | the property at `index` of a declaration, or the key or value type of a map declaration |
| `decoref` | `{"parent", "index"}` | the decorator at `index` of its parent (a model file, declaration or property) |
| `validatorref` | `{"owner", "part"}` | a validator of a field or scalar declaration |
| `factory`, `serializer`, `introspector` | `{"mm", ...}` | `new Factory(mm)`, `new Serializer(factory, mm, defaultOptions)`, `new Introspector(mm)` |
| `typed` | `{"ctor", "fqn", "ns", "type", "id", "timestamp", "fields"}` (plus handles) | a Resource, ValidatedResource or Relationship: its handles and every own property, in order |
| `predicate` | `{"kind": "fqn-in", "names": [...]}` | a filter predicate: true when the declaration's fully qualified name is in `names` |
| `decoratorfactory` | `{"kind": "base"}` or `{"kind": "names", "names": [...]}` | the exported base `DecoratorFactory` (its `newDecorator` throws `Error('abstract function called')`), or a factory returning `new Decorator(parent, ast)` when `ast.name` is in `names` and `null` otherwise |
| `visitor` | `{"kind": "pair"}` | the argument of `accept(visitor, parameters)`: an object whose `visit(thing, parameters)` returns `[thing, parameters]` |
| `errnew` | `{"cls", "args"}` | `new TypeNotFoundException(...args)` or `new SecurityException(...args)` |

A model manager recipe's `steps` are the state-changing public calls made on
it, in order. Each step has the shape `{method, args, status: "ok" |
"error", errorClass}`. Replaying a recipe re-runs the steps. A step whose
status or error class differs from the recorded one is a **state
divergence**, and the fixture fails. The state-changing methods are
`addModel`, `addCTOModel`, `addModelFile`, `addModelFiles`,
`updateModelFile`, `deleteModelFile`, `clearModelFiles`, `fromAst`,
`validateModelFiles`, and `addDecoratorFactory` (when its argument is a
`decoratorfactory`).

`predicate`, `decoratorfactory` and `visitor` stand for arguments that are
code in JavaScript. Each one is defined by what it does, so an engine in any
language can build it.

### Results (outcomes only)

An op that returns a concerto-core object is recorded as a summary of that
object:

| Kind | Shape |
|---|---|
| `ModelManager` | `{"ctor", "namespaces", "ast"}`: the model manager's class, `getNamespaces()`, and its full AST |
| `ModelFile` | `{"namespace", "name", "ast"}` |
| `Declaration` | `{"ctor", "fqn"}` |
| `Property` | `{"ctor", "fqn"}`, or `{"ctor", "type"}` for a map key or value type |
| `Decorator` | `{"name", "arguments"}` |
| `Validator` | `{"ctor"}` |
| `Introspector` | `{}` |
| `typed` | as for inputs, without handles |
| `error` | `{"error": {"class", "message", "location", "component"}}`: an exception returned as a value |
| `throws` | `{"class", "message"}`: reading this part of the summary threw |
| `object` | `{"ctor"}`: any other object, by its constructor name |
| `function`, `symbol`, `cycle` | a function, a symbol (`{"value"}`), or a reference back to an enclosing value |

## Blob store

Large values are stored once, in `fixtures/blobs/<aa>/<sha256>.json`, where
`<aa>` is the first two hex digits of the hash. This covers strings over
1,024 characters, and objects or arrays whose JSON is over 4,096 characters
after their own children were stored. Such a value is referenced as
`{"@@oracle": "blob", "sha256": "<hex>"}`. The sha256 is of the stored JSON
text. A blob can itself contain blob references. Resolve every reference
before you decode a fixture. A missing, corrupt or unreadable blob is a
harness error, never a pass. The supplement's fixtures have their blobs
inlined.

## Asynchronous ops

The asynchronous ops are `ModelLoader.loadModelManager`,
`ModelLoader.loadModelManagerFromModelFiles` and
`ModelManager.updateExternalModels`. Their fixtures carry the op's
environment:

- `inputs.fs` maps each relative path the op read to the file's UTF-8
  contents. Write these files into a fresh directory, and run the op with
  that directory as its working directory.
- `inputs.net` maps each URL the op fetched to `{"status", "body"}`. Answer
  every fetch from it. A fetch of any other URL is a divergence.

The outcome is what the op's promise settles to.

## Randomness

`env.random` is true when the op drew from `Math.random`. That happens in
sample instance generation (`generate: 'sample'`). The JS adapter runs every
op under a seeded PRNG (mulberry32 with seed `0x0c0ffee`, `lib/env.js`), so
these fixtures replay exactly. An engine that cannot reproduce that PRNG
should compare `env.random` fixtures by structure, or skip them.

## The manifests

`fixtures/manifest.json` and `fixtures/supplement/manifest.json` hold
recording statistics. They give counts by source and op, and the calls that
were skipped (`skipped_calls`), keyed by op and reason. The reasons are:

| Reason | Meaning |
|---|---|
| `env-stubbed:<where>` | a concerto function, `Math.random` or the clock was a test stub |
| `nonplain:<reason>` | an input that is not plain data and has no recipe |
| `nonplain:tainted-modelmanager:<reason>` | the receiver's model manager stopped being reproducible from plain data |
| `async-result` | a synchronous op returned a promise |
| `nonportable-path` | an asynchronous op read a file outside its working directory |
| `writes-to-disk` | the op writes files |

The manifests are not fixtures, and the judge ignores them.

## The CTO -> AST cache

`cto-cache/<aa>/<sha256>.json` holds CTO text from the fixtures, pre-parsed
by `@accordproject/concerto-cto` 5.0.0. It is for engines that cannot parse
CTO themselves. Each entry is keyed by the sha256 of
`JSON.stringify([cto, fileName, skipLocationNodes])`, where
`skipLocationNodes` is the model manager's option of that name. An entry is
either `{"ast": <AST>}` or `{"error": {"class", "message", "location"}}` for
a `ParseException`. It covers the five `ModelManager` methods that parse
CTO: `addCTOModel`, `addModel`, `addModelFiles`, `updateModelFile` and
`validateModelFile`. Use it only for a `ModelManager`: `BaseModelManager`
and `AstModelManager` never parse CTO.

The cache is the one the corpus was published with, and it is not
complete. It has 633 entries. The fixtures hold 712 distinct
`(cto, fileName, skipLocationNodes)` keys, so 79 are missing. Parse a missing text with
concerto-cto 5.0.0 under the same key, or treat it as a harness error.
