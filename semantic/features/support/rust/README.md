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

The process exits non-zero on any FAIL or XPASS, or if a feature file fails to
parse (its scenarios would otherwise just be missing from the table). A missing
fixture never counts as a pass. The filter reports it as a SKIP, and if a
fixture fails to load during a run, the scenario fails.

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

- `scalars.feature`: the titles of "should throw for invalid regex" (line 76)
  and "should pass for valid regex pattern" (line 82) are swapped. Line 76
  loads the valid-regex fixture and expects no error. Line 82 loads the
  invalid-regex fixture, which does not exist, and expects an error. The
  expectations match the fixtures; only the titles are wrong. This needs fixing
  upstream, not in this harness.
