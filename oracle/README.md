# Behavioural oracle corpus for concerto-core 5.0.0

The corpus records what `@accordproject/concerto-core` **5.0.0** does at its
public API. Each fixture is one public call: an op, its inputs, and its
outcome, which is either a result or an exception class. You replay the
fixtures against another engine through an adapter, and a judge compares the
outcomes. Any implementation of Concerto can use it to check that it
behaves like the 5.0.0 reference. That includes a new build of concerto-core,
a port to another language, or a client that loads models and validates
instances.

| | |
|---|---|
| Fixtures | 16,242 (unit 4,082, data 10,231, conformance 815, gaps 658, lifted 299, supplement 157) |
| Ops | 261 public constructors, methods and statics of concerto-core |
| Agreement of the reference with itself | 16,242 of 16,242 pass (about 50 s) |
| Size | 3.1 MB download, 51 MB unpacked |

The fixtures were recorded from concerto-core 5.0.0's own test suite
(`unit`), its test data (`data`), this repository's scenarios
(`conformance`), and targeted inputs for branches those miss (`gaps`,
`lifted`, `supplement`). [FORMAT.md](FORMAT.md) describes the fixture
format. [ADAPTERS.md](ADAPTERS.md) describes how to replay the fixtures
against your engine.

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
