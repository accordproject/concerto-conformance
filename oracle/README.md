# Behavioural oracle corpus for concerto-core 5.0.0

The corpus records what `@accordproject/concerto-core` **5.0.0** does at its
public API, as 16,242 fixtures. This directory has the tools to replay the
corpus against another engine and to judge each result.

## Why

The scenarios elsewhere in this repository state Concerto's rules one at a
time, by hand. They are readable, but they cover only the rules someone
thought to write down. concerto-core's actual behaviour is much larger.
Hundreds of public methods each have edge cases: which inputs are rejected,
with which exception, what a valid instance serialises to, how decorators
apply. Most of it is defined only by the 5.0.0 code.

Anyone who reimplements or changes that behaviour needs to know whether the
new version behaves like 5.0.0, case by case. This could be a port to
another language, a new major version, or a client that loads models and
validates instances itself. Reading the 5.0.0 code doesn't scale to that,
and its unit tests check the code's own internals, not a public contract.

The oracle answers it differently. It records 5.0.0's own answers to a large
number of real calls, and lets any engine be checked against them
automatically. That turns 5.0.0's observable behaviour into an executable
specification. A difference is then either a bug in the new engine or a
deliberate change, and deliberate changes are listed with a reason
(`expected-6.0.0.tsv`).

## How it works

1. **Recording.** concerto-core 5.0.0's own test suite and test data, this
   repository's scenarios, and some targeted inputs were run with the public
   API instrumented. Every outermost public call was saved as a *fixture*.
   A fixture holds the *op* (the call, as `<Class>.<method>`), its inputs and
   its outcome: the value it returned, or the class of exception it threw.
   Calls made by other calls were not recorded separately. Calls whose
   inputs can't be described as plain data, such as test stubs or functions,
   were skipped and counted. The recorder lives with concerto-core's source
   (accordproject/concerto#1327); this directory has the replay side.
2. **Encoding.** Inputs are stored as plain JSON. A concerto object, such as
   a model manager, is stored as a *recipe*: the public calls that rebuild
   it. For example: "create a `ModelManager` with these options, then call
   `addCTOModel` with this text". Large values are stored once, by hash.
   Identical calls are stored once. ([FORMAT.md](FORMAT.md))
3. **Replay.** For each fixture, an *adapter* for the engine under test
   rebuilds the inputs from their recipes, makes the same call, and reports
   what happened. ([ADAPTERS.md](ADAPTERS.md))
4. **Judging.** The judge puts both outcomes in canonical form: sorted keys,
   and generated ids and timestamps replaced by placeholders. It then
   compares them. A fixture *passes* when both engines threw or neither
   did, and the exception class, component, location and values match. Message text is
   not compared, so an engine may word its errors differently.

The tools work for any engine:
- A JS build of concerto-core needs no code at all: pass its package
  directory.
- An engine in another language can answer over stdin and stdout.
- The fuzz harness in `../fuzz` reuses the same adapters to compare engines
  on mutated inputs that were never recorded.

## The corpus at a glance

| | |
|---|---|
| Fixtures | 16,242 (unit 4,082, data 10,231, conformance 815, gaps 658, lifted 299, supplement 157) |
| Ops | 261 public constructors, methods and statics of concerto-core |
| Agreement of the reference with itself | 16,242 of 16,242 pass (about 50 s) |
| Size | 3.1 MB download, 51 MB unpacked |

Each fixture's *source* says where its call came from:
- `unit`: concerto-core 5.0.0's own test suite;
- `data`: its test data;
- `conformance`: this repository's scenarios;
- `gaps`, `lifted`, `supplement`: targeted inputs for code those miss.

## Quick start

Node.js 18 or later. Run these from the repository root:

```sh
node oracle/bin/fetch-corpus.js            # download, verify (sha256) and unpack into oracle/corpus/
(cd oracle/reference && npm ci)            # install the 5.0.0 reference (only needed for --engine reference)
node oracle/bin/replay.js                  # replay against the reference: every fixture passes
node oracle/bin/replay.js --engine <adapter module | concerto-core package directory>
```

The oracle tools have no dependencies beyond Node.js. Only the reference
adapter needs `oracle/reference` installed.

## Getting the corpus

The corpus is not stored in git. It is the `.tgz` asset of a GitHub release
of this repository, named in [`corpus.json`](corpus.json):

```json
{
  "release": "oracle-corpus-5.0.0-<12 hex>",
  "asset": "oracle-corpus-5.0.0-<12 hex>.tgz",
  "sha256": "<sha256 of the .tgz>",
  "tar_sha256": "<sha256 of the uncompressed tar>"
}
```

`bin/fetch-corpus.js` downloads the asset and checks both hashes. It then
unpacks the asset into `oracle/corpus/`:

```
oracle/corpus/
  CORPUS.json            provenance: the source archives, their hashes, counts by source
  fixtures/
    <source>/<op>/<id>.json   one fixture (source: unit, data, conformance, gaps, lifted, supplement)
    blobs/<aa>/<sha256>.json  large values stored once (FORMAT.md, "Blob store")
    manifest.json             recording statistics: recorded and skipped calls by op and reason
    supplement/manifest.json  the same for the supplement
  cto-cache/<aa>/<sha256>.json  CTO text pre-parsed to ASTs by concerto-cto 5.0.0 (FORMAT.md)
```

Options:

- `--file <tgz>` verifies and unpacks a copy you already have.
- `--dest <dir>` unpacks it somewhere else.
- `--force` replaces an existing directory.

To check a download by hand, run `sha256sum` on the `.tgz` and compare the
result with `corpus.json`'s `sha256`. A different gzip build can produce
different `.tgz` bytes for the same files. The uncompressed tar has a stable
hash of its own: `gunzip -c <tgz> | sha256sum` gives `tar_sha256`.

### Building the release asset (maintainers)

The asset is built from the two archives the corpus was recorded as: the
pinned corpus and its additive supplement.

```sh
node oracle/bin/build-corpus-tarball.js \
  --pin oracle-corpus-p107-06aa375.tgz \
  --supplement oracle-corpus-supplement-d842c0ab7.tgz \
  --out <dir> --write-config
```

The build follows these rules:

- **Source checks.** It checks each archive against its recorded content
  hash. It refuses a supplement that would change a pinned file.
- **Junk files.** It drops macOS `._*` files.
- **Paths.** The pinned corpus recorded some `fileName` arguments as
  absolute paths on the recording machine. The build rewrites them the way
  the recorder now does: `<conformance>/...` for a file in this repository,
  `<repo>/...` for one in accordproject/concerto. It fails if any other
  home-directory path is left. The 32 fixtures and 1 blob this changes get
  new ids (fixture ids and blob hashes are content hashes), and
  `CORPUS.json` lists every old and new path under `renamed`.
- **Determinism.** The tarball always has the same bytes for the same input:
  entries sorted by path, mode 0644, uid and gid 0, mtime 0, and a gzip
  header with no name and mtime 0.
- **Naming.** The release is named after the first 12 hex digits of
  `tar_sha256`. `--write-config` records the result in `corpus.json`.

## Replaying

```
node oracle/bin/replay.js [--engine reference | <concerto-core package dir> | <adapter module>]
    [--fixtures <dir>] [--source <source>] [--op <op>]
    [--expected <tsv>] [--report <file.json>] [--max-failures N]
```

| Option | Meaning |
|---|---|
| `--engine reference` | concerto-core 5.0.0 from `oracle/reference` (default) |
| `--engine <dir>` | any JS build of concerto-core: the directory holding its `package.json`, with the compiled modules under `dist/` |
| `--engine <module>` | your own adapter (ADAPTERS.md) |
| `--fixtures <dir>` | the corpus (default `oracle/corpus/fixtures`) |
| `--source`, `--op` | replay only one source or op |
| `--expected <tsv>` | fixtures your engine is known to differ on (below) |
| `--report <file>` | a JSON report: totals by source and op, and every failure |

The summary line counts fixtures that `pass`, `fail` or hit a
`harness_error`:

- **pass**: the canonical outcome matches the recorded one, apart from
  exception message text.
- **fail**: the outcome differs, the engine diverged while rebuilding the
  inputs, or the engine does not support the op.
- **harness_error**: the fixture or one of its blobs is missing or
  malformed. A harness error never counts as a pass.

`message_only` counts the passes whose exception message differs. The judge
compares whether the call throws, the exception class, the component, the
location, values and effects. It does not compare message text. The exit
status is 0 only when no fixture fails and none has a harness error.

Replaying the whole corpus against the reference:

```
engine=reference@5.0.0 total=16242 pass=16242 fail=0 harness_error=0 unsupported=0 message_only=0 agreement=100%
```

## Differences in concerto-core 6.0.0

Concerto 6.0.0 changes some behaviour on purpose: stricter validation, and
specific exception classes where 5.0.0 crashed or threw `BaseException`.
[`expected-6.0.0.tsv`](expected-6.0.0.tsv) lists the 271 fixtures whose
outcome changes. Each one has a one-line reason and a link to the change.
Don't test a 6.0.x engine against the recorded outcome of those fixtures:

```sh
node oracle/bin/replay.js --engine <6.0.x engine> --expected oracle/expected-6.0.0.tsv
```

With `--expected`, a listed fixture that fails is counted as `expected_fail`,
not `fail`. A listed fixture that passes is reported as `unexpected_pass`, so
the list can be kept accurate. (A build is labelled by its `package.json`
name and version, so a 6.0.0 candidate whose version is not bumped yet shows
as `@5.0.0`.) Against the 6.0.0 release candidate
(accordproject/concerto#1327 at `cf32ef406`, concerto-core built with
`npm run build`):

```
total=16242 pass=15971 fail=0 harness_error=0 expected_fail=271 unexpected_pass=0 unsupported=0 message_only=58
```

| Change | Fixtures | Link |
|---|---|---|
| Namespaces must be versioned (the unversioned decorator command target `test`) | 154 | accordproject/concerto#1447 |
| Validator errors throw `IllegalModelException` (models) or `ValidationException` (instances), not `BaseException` | 58 | accordproject/concerto#1445 |
| Only strict ISO 8601 `DateTime` strings are accepted | 28 | accordproject/concerto#1424 |
| Specific exceptions where 5.0.0 crashed (`TypeError`, `RangeError`), and `isValidIdentifier` of a non-string | 22 | accordproject/concerto#1454 |
| Model ASTs are checked against the metamodel when they are loaded | 8 | accordproject/concerto#1440 |
| Scalar validation is answered from the engine model | 1 | accordproject/concerto#1507 |

## What the oracle does not cover

- **Message text.** An engine may word its messages differently.
- **Skipped calls.** The recorder skipped calls whose inputs are not plain
  data, such as functions, sinon stubs and objects with patched methods.
  `fixtures/manifest.json` counts them by op and reason.
- **Asynchronous ops.** These are `ModelLoader.loadModelManager`,
  `loadModelManagerFromModelFiles` and `ModelManager.updateExternalModels`.
  Each fixture for one of them carries the files and network responses the op
  read (FORMAT.md). An engine that fetches any other URL fails the fixture.

## Layout

```
README.md, FORMAT.md, ADAPTERS.md
corpus.json            the release asset: name, URL, sha256, tar_sha256, counts
expected-6.0.0.tsv     fixtures concerto-core 6.0.0 changes on purpose
bin/replay.js          replay the corpus against an engine and judge it
bin/fetch-corpus.js    download, verify and unpack the corpus
bin/build-corpus-tarball.js  build the release asset from its source archives
lib/                   judge.js, canon.js, codec.js, store.js, encodable.js, ops.js, env.js,
                       adapter.js (the JS adapter), core.js (loads a concerto-core build),
                       engines.js (resolves --engine), tar.js
reference/             package.json and lockfile pinning concerto-core, concerto-cto, concerto-util 5.0.0
examples/              a minimal adapter (ADAPTERS.md)
test/                  node --test oracle/test/*.test.js
```
