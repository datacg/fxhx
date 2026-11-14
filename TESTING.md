# Testing

On Windows, with Node.js 18 or later:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run release:candidate   # test package, marked as not validated in After Effects
npm.cmd run release             # requires docs/validation/ae-host-<version>.json
```

`check` builds `dist/FXHX.jsx` and runs 282 Node tests with After Effects mocks. `release` also builds and verifies the ZIP with Windows tar, an allowlist, SHA-256 hashes, and a JSX comparison, and runs only when the [host checklist](docs/HOST_SMOKE_CHECKLIST.md) record exists. The tests do not launch After Effects.

The fixtures use in-memory objects to represent compositions, layers, effects, and ScriptUI controls. Coverage includes simulated native selection, scopes, grouping, mixed values, editing the whole selection, menus, checkboxes, colors, keyframes, presets, write and readback failures, recovery, caching, persistence, the Portuguese interface, and update checks. The fixtures use small scan slices (`FX.Scanner.SLICE_STEPS = 30`) so that multi-tick paths stay covered; production uses 150.

`tests/updates.test.cjs` simulates the network transport, validates versions and URLs, and verifies that the check only runs on click. The suite never calls GitHub.

`npm.cmd run host:prepare` only prepares a fixture, locked by default, in `artifacts/`. It does not launch the host and does not authorize tests on real projects.

The [host checklist](docs/HOST_SMOKE_CHECKLIST.md) is required for every release; [docs/UI_QA.md](docs/UI_QA.md) keeps detailed per-version checks (in Portuguese). Mocks do not certify visual behavior, clicks, docking, or performance inside the host.
