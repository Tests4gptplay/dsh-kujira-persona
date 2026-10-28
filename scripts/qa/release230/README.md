# 2.3.0 focused regression tests

These tests use temporary directories and synthetic fixtures; no saved user conversations, journals or role data are required. The production modules and packaged role presets are imported from this checkout. Test-generated files go to the operating system temporary directory.

After installing the package dependencies normally (`npm install`), run from the repository root:

```sh
node --test --test-concurrency=1 --test-timeout=60000 scripts/qa/release230/*.test.mjs scripts/qa/release230/recovery/*.test.mjs scripts/qa/release230/independent/*.test.mjs
```

Coverage: 13 animation anti-freeze cases, 23 interruption/recovery and compatibility cases, and 34 independent diary/role-I/O cases. These are additional to the existing 292-case regression command. Windows CI runs the 57 recovery and independent cases as well as its native desktop checks; Linux CI runs all 362 cases.

Portability changes use module-relative file URLs for imports/child processes, system temporary directories for fixtures, and normalized separators only for fault-injection path matching. No production code is rewritten by these tests.

The simultaneous no-basis append test does not assume that asynchronous path resolution preserves invocation order. It requires exactly one summary commit and one pending proposal, verifies the winner/loser pairing, and verifies that both bodies occur exactly once. Its sequential-write and post-contention assertions remain in place.
