# Validation — FXHX 0.1.16

**282 automated tests pass**, using in-memory fixtures, an ES3 build, and an identity check between the sources and the JSX. The ZIP is extracted with Windows tar and checked against an allowlist, SHA-256 hashes, and JSX identity.

The tests cover selection, scopes, mixed values, editing the whole selection, keyframe removal, limits, menus, presets, protection of expressions and opaque data, host failures, readback, recovery, and the absence of network queries at startup. Version 0.1.16 adds decimal commas, precision tolerance on readback, color and checkbox entry, refresh without relisting the project, the Portuguese interface, and the release gate.

## Validation in After Effects

A final release requires a `docs/validation/ae-host-<version>.json` record with every item of the [host checklist](docs/HOST_SMOKE_CHECKLIST.md) passing. **0.1.16 was published before that record existed**, so native validation is still pending. The most sensitive points are layout at 100/150/200% display scaling, the color picker, checkbox detection in third-party plugins, Apply time in large projects, and the Portuguese interface.

The automated tests do not launch After Effects, create real projects, or query third-party licenses.

The panel validates targets before writing and uses one Undo group per operation. Synchronous host APIs can still fail after that validation and leave partial changes. Results distinguishes failures before writing, confirmed writes, and uncertain outcomes; there is no automatic retry or rollback.
