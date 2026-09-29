# Rust conformance harness

Runs the semantic feature files against
[concerto-rust](https://github.com/accordproject/concerto-rust)
(`accordproject-concerto-core`, lib `concerto_core`).

Run it from the repository root:

```sh
cargo run --manifest-path semantic/features/support/rust/cucumber_tests/Cargo.toml
```

The `--manifest-path` is relative to the directory you run `cargo` from; from
anywhere else, adjust it or pass an absolute path. The feature files and
fixtures are then found relative to the crate itself, whatever the working
directory.

## Choosing the concerto-rust to test

By default the harness depends on the `main` branch of concerto-rust, pinned
by `Cargo.lock`. Run `cargo update -p accordproject-concerto-core` to move the
pin to the latest `main`.

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

After the run, the harness prints one row per scenario:

| Result | Meaning |
|--------|---------|
| PASS   | The scenario passed. |
| FAIL   | The scenario failed, or the harness hit an error. |
| SKIP   | Not run: tagged `@skip` upstream, tagged `@skip-rust`, or a fixture is missing, unreadable or not valid JSON. The reason is shown. |
| XFAIL  | Failed as recorded in `EXPECTED_FAILURES` in `src/main.rs`. |
| XPASS  | Passed although listed in `EXPECTED_FAILURES`; remove the entry. |

The process exits non-zero on any FAIL or XPASS, on any ERROR (a missing,
unreadable or invalid-JSON fixture), or if a feature file fails to parse (its
scenarios would otherwise just be missing from the table). A missing fixture
is a harness error (plan section 5.1), not a benign skip like an upstream
`@skip`/`@skip-rust` tag, so it shows as ERROR in the table and fails the run.

Set `CONFORMANCE_INCLUDE_SKIP_RUST=1` to also run scenarios tagged `@skip-rust`.

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

Those repaired scenarios assert an error class and a rule (`@rule:<ID>`),
plus the error type for validator errors, never message text (maintainer
decisions D1 and Q-15 on accordproject/concerto-rust#249; BC-39). This
harness does not define those steps yet, so they are tagged `@skip-rust`.

The scenarios promoted by P5-08b (accordproject/concerto-rust#249) use steps this
harness does not define yet (`an error of class ... should be thrown`, `the error
should mention ...`, `the model manager options:`, `I load the following models
with validation:`), so they are tagged `@skip-rust`. The 9 positive runs that
need only this harness's steps (the CON-02, CON-04 and CON-09 positives, DEC-03
and the 5 IDN-02 rows) are not tagged and run here. Adding the other steps is a
follow-up; see the main README.

