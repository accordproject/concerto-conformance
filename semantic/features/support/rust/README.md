# Rust conformance harness

Runs the semantic feature files against
[concerto-rust](https://github.com/accordproject/concerto-rust)
(`accordproject-concerto-core`, lib `concerto_core`).

```sh
cargo run --manifest-path semantic/features/support/rust/cucumber_tests/Cargo.toml
```

Paths to the feature files and fixtures are resolved from this crate's
location, so the command works from any directory.

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
| SKIP   | Not run: tagged `@skip-rust`, or a fixture is missing, unreadable or not valid JSON. The reason is shown. |
| XFAIL  | Failed as recorded in `EXPECTED_FAILURES` in `src/main.rs`. |
| XPASS  | Passed although listed in `EXPECTED_FAILURES`; remove the entry. |

Scenarios tagged `@skip` are not listed. The process exits non-zero on any
FAIL or XPASS. A missing fixture never counts as a pass. The filter reports it
as a SKIP, and if a fixture fails to load during a run, the scenario fails.

Set `CONFORMANCE_INCLUDE_SKIP_RUST=1` to also run scenarios tagged `@skip-rust`.
