# Rust conformance harness

Runs the semantic feature files (`semantic/features`) and the instance feature
files (`validate/features`) against
[concerto-rust](https://github.com/accordproject/concerto-rust)
(`accordproject-concerto-core`, lib `concerto_core`, with its `js-compat`
feature for the TS exception class and a validator error's `errorType`).

The steps match the JavaScript harness's (`semantic/features/support/Javascript/steps.ts`
and `validate/validateSteps.js`). The instance steps read each `.cto` model
from its `<model>.ast.json` sibling, load it into a `ModelManager` and validate
the models (as `ModelLoader.loadModelManager` does offline), then check the
instance with `ModelManager::validate_instance`, which is `Serializer.fromJSON`
with validation on and default options.

Run it from the repository root:

```sh
cargo run --manifest-path semantic/features/support/rust/cucumber_tests/Cargo.toml
```

The `--manifest-path` is relative to the directory you run `cargo` from; from
anywhere else, adjust it or pass an absolute path. The feature files and
fixtures are then found relative to the crate itself, whatever the working
directory.

## Choosing the concerto-rust to test

By default the harness depends on the migration integration branch of
concerto-rust (`claude/tender-pascal-ocwf9q`), pinned by `Cargo.lock`, because
`main` does not have the instance API or the `js-compat` feature yet; switch
the branch back to `main` in `cucumber_tests/Cargo.toml` once it has them. Run
`cargo update -p accordproject-concerto-core` to move the pin to the latest
commit of the branch.

To test a local checkout instead, patch the git dependency on the command line.
The path is relative to the directory you run `cargo` from:

```sh
cargo run \
  --config 'patch."https://github.com/accordproject/concerto-rust".accordproject-concerto-core.path="../concerto-rust/concerto-core"' \
  --manifest-path semantic/features/support/rust/cucumber_tests/Cargo.toml
```

Inside concerto-rust's CI, where this repository is checked out to
`concerto-conformance/`, the path is `concerto-core`. The same line can go
under `[patch."https://github.com/accordproject/concerto-rust"]` in
`.cargo/config.toml` for a persistent override. Don't commit a `Cargo.lock`
produced while the patch is active.

## Results

After the run, the harness prints one row per scenario, with the feature
file named by its suite directory (`semantic/` or `validate/`):

| Result | Meaning |
|--------|---------|
| PASS   | The scenario passed. |
| FAIL   | The scenario failed, or the harness hit an error. |
| SKIP   | Not run: tagged `@skip` upstream, or tagged `@skip-rust`. The reason is shown. |
| ERROR  | Not run: a fixture is missing, unreadable or not valid JSON. The reason is shown. |
| XFAIL  | Failed as recorded in `EXPECTED_FAILURES` in `src/main.rs`. |
| XPASS  | Passed although listed in `EXPECTED_FAILURES`; remove the entry. |

The process exits non-zero on any FAIL or XPASS, on any ERROR (a missing,
unreadable or invalid-JSON fixture), or if a feature file fails to parse (its
scenarios would otherwise just be missing from the table). A missing fixture
is a harness error (plan section 5.1), not a benign skip like an upstream
`@skip`/`@skip-rust` tag, so it shows as ERROR in the table and fails the run.

Set `CONFORMANCE_INCLUDE_SKIP_RUST=1` to also run scenarios tagged `@skip-rust`.
No scenario is tagged `@skip-rust` at the moment; a new tag needs a one-line
comment giving its reason.

### Expected failures

An `EXPECTED_FAILURES` entry names a fixture and the scenario's expected
message. It only produces XFAIL when the runtime raised an error and that error
did not match the expected message. Every other failure is still a FAIL: no
error raised, a different expectation failing, or a harness panic.

### Error expectations

`an error should be thrown with message "..."` checks for a substring. An
expectation written as `/pattern/flags` is a regular expression, as in the
JavaScript harness. The `i`, `m` and `s` flags apply; `g`, `u` and `y` are
ignored.

## Known issues in the suite

Fixed by P5-08a (accordproject/concerto-rust#248): the swapped
`scalars.feature` regex titles, the 9 scenarios that asserted `message ""`
against a missing fixture, and the 10 `.cto` files with no JSON AST. See
`migration/CONFORMANCE-PROMOTION-PLAN.md` (concerto) section 1.P for the
background.

Those repaired scenarios, and the ones promoted by P5-08b
(accordproject/concerto-rust#249), assert an error class and a rule
(`@rule:<ID>`), or, for validator errors, the error class plus the error type
(BC-39), never message text (maintainer decisions D1 and Q-15 on
accordproject/concerto-rust#249). P5-62 (accordproject/concerto-rust#397) added
the steps they use to this harness and dropped their `@skip-rust` tags, with
the six stale `EXPECTED_FAILURES` entries.
