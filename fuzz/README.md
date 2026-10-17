# Differential fuzzing against concerto-core 5.0.0

The oracle corpus (`../oracle`) checks an engine on inputs that were
recorded. This harness checks it on inputs that were not. It takes real
models and instances from the corpus and mutates them deterministically. It
then runs each mutated case through a **reference** engine and a
**candidate** engine, and compares the canonical outcomes the way the
oracle's judge does: same throw or no throw, same exception class, same
component, location and values, with message text ignored.

Any engine the oracle can replay can be fuzzed: concerto-core 5.0.0 (the
default reference), another JS build of concerto-core, or your own adapter
(`../oracle/ADAPTERS.md`). The harness has no dependencies beyond Node.js.

## Method

This is **mutation-based differential fuzzing**. It has three parts:

1. **Mutation-based.** New inputs are made by changing real ones, not by
   generating them from a grammar. Each case starts from a document that
   concerto-core 5.0.0 was actually given in a recorded test. That document
   is a model AST, or an instance and its model. The fuzzer applies one to
   four random edits to its JSON tree. Starting from real documents keeps
   most cases close to valid, so they get past the first checks and reach
   deeper code. A purely random document is usually rejected at once.
2. **Differential.** There is no hand-written expected result for a mutated
   input. Instead, two engines run the same case and their outcomes are
   compared. A disagreement is a *divergence*: one of the two engines is
   wrong, or the difference is intended. The reference is assumed correct
   by default. Known, intended differences are listed separately (see
   "Expected differences").
3. **Seeded and reproducible.** All randomness comes from one small PRNG
   (mulberry32) seeded by an integer. One seed picks the cases of a whole
   run. A second seed per case picks the edits. Rerunning with the same
   seeds and corpus gives exactly the same cases.

The edits are generic JSON edits. They know nothing of Concerto's grammar.
Each edit picks one node of the document (an object key or an array
element) at random and does one of eight things to it:

| Edit | Example |
|---|---|
| delete it | drop `"isOptional"`, or one element of `"properties"` |
| replace it with an unrelated value | a string, number, boolean, `null`, `[]` or `{}` |
| flip a boolean | `"isAbstract": false` becomes `true` |
| duplicate it | `name` gains a sibling `name_dup`; an array element appears twice |
| change a string | truncate it, double it, upper-case it, or append junk (`"__proto__"`, `"\u0000"`, 5,000 characters, emoji) |
| push a number to an edge | add or substitute `NaN`, `±Infinity`, `-0`, `2^53`, `1e308` |
| wrap or unwrap | `x` becomes `[x]`, and `[x]` becomes `x` |
| shuffle an array | reorder `declarations` or `properties` |

Nodes marked `@@oracle` are never edited. They describe how to rebuild the
test's set-up, such as a model manager or a serializer, not the document
under test (see `../oracle/FORMAT.md`).

When a run finds divergences, two steps make them manageable:
- **Clustering** groups divergences that look the same, by op, by each
  engine's outcome, and by message with names and numbers blanked out.
- **Reduction** shrinks one sample per cluster. It removes edits one at a
  time and keeps each removal while the divergence still looks the same.
  This is a greedy form of delta debugging. What remains is usually a
  single edit that triggers the difference.

## Terms

| Term | Meaning |
|---|---|
| engine | an implementation of Concerto under test, reached through an adapter (`../oracle/ADAPTERS.md`) |
| reference, candidate | the two engines compared. The reference is concerto-core 5.0.0 by default; the candidate is the engine you are testing |
| op | a public API call of concerto-core, named `<Class>.<method>`, for example `Serializer.fromJSON`. The fuzzer targets four ops (see "What is mutated") |
| seed fixture | a recorded oracle fixture used as the starting point for mutation |
| mutation seed | the integer that fixes which edits are applied to a seed fixture |
| run seed | the integer that fixes which seed fixtures and mutation seeds a whole run uses (`--run-seed`) |
| case | one mutated input: a seed fixture plus a mutation seed |
| outcome | what an engine did with a case: returned a value, or threw an exception of some class. Outcomes are compared in canonical form, ignoring message text |
| agreement | both engines gave the same outcome |
| divergence | the engines gave different outcomes |
| expected difference | a divergence that a list of intended changes accepts (`--expected`) |
| harness error | a case one engine could not run at all, because the set-up failed for reasons unrelated to the engine's behaviour. Never counted as an agreement |
| repro | the minimum needed to replay one case: `{op, seedFile, mutationSeed}`, or after reduction `{op, seedFile, edits}` |
| cluster | a group of divergences with the same signature (`lib/signature.js`) |

## Running a campaign

```sh
node oracle/bin/fetch-corpus.js            # the corpus seeds the fuzzer
(cd oracle/reference && npm ci)            # the 5.0.0 reference
node fuzz/bin/fuzz.js --candidate <engine> --count 20000 --run-seed 1
```

| Option | Meaning |
|---|---|
| `--candidate <engine>` | the engine under test: a concerto-core package directory, an adapter module, or `reference` |
| `--reference <engine>` | what it is compared with (default `reference`, concerto-core 5.0.0) |
| `--count N` | number of cases (default 1,000) |
| `--run-seed N` | the run's seed (default 1); the same seed, corpus and `--seeds-per-op` give the same cases |
| `--seeds-per-op N` | how many corpus fixtures per target op seed the run (default 25) |
| `--batch-size N` | cases per engine process (default 200) |
| `--expected <module>` | differences the candidate is known to have on purpose (below) |
| `--fixtures <dir>` | the corpus (default `oracle/corpus/fixtures`) |
| `--out-dir <dir>` | where results go (default `fuzz/results`) |

Each engine runs in its own process (`lib/worker.js`), so two builds never
share one. The run writes:

```
run.json               counts: ran = agree + divergences + expectedDifferences + harnessErrorCases,
                       overall and by op; harness errors per side; messageOnlyAgree (agreements
                       whose message alone differs)
divergences.jsonl      one line per divergence: {op, seedFile, mutationSeed, reference, candidate}
expected.jsonl         the same, plus {expected: {id, reason, link}}, for accepted differences
harness-errors.jsonl   cases where a side could not run the case, with both sides kept
```

The exit status is 1 when any divergence or harness error was found.

## What is mutated

`lib/seeds.js` targets four ops, with the plain document each one takes:

| Op | Document mutated |
|---|---|
| `ModelManager.fromAst` | the metamodel AST (`args[0]`) |
| `ModelManager.addModelFile` | the model file's AST (`args[0].ast`) |
| `Serializer.fromJSON` | the instance JSON (`args[0]`) |
| `Resource.validate` | the resource's own field values (`target.fields`) |

The rest of the fixture is replayed unchanged, so a mutated case still runs
through real model managers, serializers and factories. That includes the
model manager recipe, the serializer options and the factory. Seeds come
from the corpus sources `data`, `conformance`, `unit`, `gaps` and `lifted`,
up to `--seeds-per-op` per op.

`lib/mutate.js` applies the edits described under "Method".

## The seed and repro model

Every case is reproducible on its own:

- **`{op, seedFile, mutationSeed}`** is a complete repro. `seedFile` is the
  corpus fixture, relative to the fixtures directory. `mutationSeed` is a
  32-bit integer that fully determines the edits, through a mulberry32 PRNG.
  Each line of `divergences.jsonl` carries exactly this.
- **`--run-seed`** determines which (seed fixture, mutation seed) pairs a
  run draws. So a whole run reproduces too, given the same corpus and
  `--seeds-per-op`.
- **`{op, seedFile, edits}`** is a minimised repro. `edits` is a concrete
  list of `{kind: "set" | "add" | "delete" | "insert", path, value?, index?}`
  operations (`lib/mutate.js` `applyEdits()`). It needs no seed or PRNG, so
  it is the form to keep as a regression test or to paste into a bug
  report.

```sh
# run one case on both engines and show the mutated document
node fuzz/bin/repro.js '{"op":"ModelManager.fromAst","seedFile":"gaps/ModelManager.fromAst/6070e9e683d7b3daed2ef07e.json","mutationSeed":3051875911}' \
  --candidate <engine> --doc
node fuzz/bin/repro.js @divergence.json --candidate <engine>    # the same, from a file
```

## Triage

```sh
node fuzz/bin/triage.js fuzz/results/divergences.jsonl --out clusters.json [--expected <module>]
node fuzz/bin/minimize.js clusters.json --candidate <engine>
```

- **Clustering.** `triage.js` clusters divergences by signature
  (`lib/signature.js`): the op, each side's outcome kind and exception
  class, and each side's message with quoted text and numbers blanked out.
  Each cluster keeps its first divergence as `sample`.
- **Minimising.** `minimize.js` re-derives the edits of each sample. It
  drops one edit at a time and keeps a drop when the divergence keeps its
  signature. Each cluster then gets a minimised `{seedFile, edits}` repro.
  Most clusters need a single edit.

## Expected differences

An engine may differ from 5.0.0 on purpose. For example, Concerto 6.0.0
rejects ASTs that 5.0.0 loaded, and throws a specific exception class where
5.0.0 crashed. List those differences in a module and pass it with
`--expected`:

```js
module.exports.expectedDifference = (d) =>   // d: {op, reference, candidate, ...}
    d.op === 'Serializer.fromJSON' && d.candidate.error && /DateTime/.test(d.candidate.error.message)
        ? { id: 'strict-datetime', reason: 'only strict ISO 8601 dates', link: 'https://...' }
        : null;
```

A case that matches is counted under `expectedDifferences`, not as a
divergence. [`expected/concerto-6.0.0.js`](expected/concerto-6.0.0.js) lists
the decided differences between concerto-core 5.0.0 and 6.0.0, each with a
link. Each matcher is as narrow as the decision behind it, usually the
candidate's distinctive rejection together with what 5.0.0 did.

## Regression seeds

[`seeds/regressions.json`](seeds/regressions.json) holds 17 minimised inputs
on which an earlier engine under test diverged from 5.0.0. Earlier fuzz
campaigns found them, and they cover model ASTs and instances. Replay them
on a candidate:

```sh
node fuzz/bin/regress.js --candidate <engine> [--expected fuzz/expected/concerto-6.0.0.js]
```

Each line gives the seed's verdict (`agree`, `divergence`, `expected` or
`harness`) and both outcomes. The `found` field of each seed records what
the earlier engine did.

## Results against concerto-core 6.0.0

These results are for the 6.0.0 release candidate
(accordproject/concerto#1327 at `cf32ef406`, concerto-core built with
`npm run build`), with
`--expected fuzz/expected/concerto-6.0.0.js` and the default 25 seeds per
op:

| Run | Cases | Agree (message only) | Divergences | Expected | Harness errors |
|---|---|---|---|---|---|
| `--run-seed 7` | 20,000 | 12,654 (2,520) | 0 | 7,346 | 0 |
| regression seeds | 17 | 2 | 0 | 15 | 0 |

Against itself (`--candidate reference`), the reference agrees on every
case.

## Layout

```
bin/fuzz.js        a campaign
bin/repro.js       one case, on both engines
bin/triage.js      cluster divergences by signature
bin/minimize.js    shrink each cluster's sample to the fewest edits
bin/regress.js     replay seeds/regressions.json
lib/               mutate.js, seeds.js, cases.js (rebuild a case from its repro), worker.js,
                   run-batch.js, classify.js, signature.js
expected/          expected-differences modules (concerto-6.0.0.js)
seeds/             regressions.json
test/              node --test fuzz/test/*.test.js
```
