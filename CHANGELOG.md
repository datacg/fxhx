# Changelog

## 0.1.16 — FXHX, faster edits, and a redesigned editor

- **New name, FXHX:** the panel file is now `FXHX.jsx`. Delete the old `FX Exchanger.jsx`; preferences and presets are kept.
- **Faster Apply:** edits, Enable, and Disable keep the effect list and reread only the changed effects instead of relisting the whole project. Each effect is captured once less before writing.
- **Two-pane editor** (parameter list + selected parameter), with the pending-change count on the Apply button.
- **Value entry:** decimal commas, X/Y/Z and R/G/B/A fields, colors by hex or the system color picker, and a checkbox for on/off parameters (Number... and Checkbox switch between the two).
- **Confirmation** shows a current → new table; Enter cancels, so applying always takes a click.
- **Compact panel:** three rows at the top, Refresh and Cancel in the same spot, a progress bar, no duplicate actions, and clearer messages.
- **Portuguese interface** when After Effects runs in Portuguese (`FXHX_LANG` forces a language).
- Presets can edit several parameters at once; Check for updates explains when After Effects blocks network access.
- 282 automated tests. After Effects validation follows the [host checklist](docs/HOST_SMOKE_CHECKLIST.md). [Details](docs/CHANGES_0.1.16.md).

## 0.1.15 — first public release (as FX Exchanger)

- Effect search by scope, selection by instance, layer, or group, and comparison of readable settings.
- Editing of several parameters in a single batch, with search, filters, pending changes, and review before applying.
- Mixed Values includes the current values of keyframed properties. Previous values are grouped by count and detailed per target.
- Every pending change must cover all selected effects. Protections, types, menus, limits, and keyframe authorization are checked before the first write.
- Explicit keyframe removal per parameter, including a single key. A blank field keeps each target's current value.
- Copying of chosen static parameters and single-effect presets. Expressions, opaque data, and known internal fields stay protected.
- Help → Check for updates queries the latest stable release of datacg/fxhx. Open Releases opens the download for manual installation.
- 253 automated tests, ES3 build, and verified package. Native validation pending.
