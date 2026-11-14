# FXHX 0.1.16 — reliability, UX, and architecture review

Origin: a critical development and UX/UI review of 0.1.15. This version implements the recommendations from that review. Everything was verified with Node tests and After Effects mocks (282 tests); **native validation in After Effects is still pending**. Releases are gated by the [After Effects smoke test](HOST_SMOKE_CHECKLIST.md).

## Reliability fixes

| Problem in 0.1.15 | Change |
|---|---|
| `Number("20,5")` became NaN and the message was "Finite number required". | `FX.U.parseNumber` accepts decimal commas and rejects hex, exponents, thousands separators, and empty text, with a readable message ("Radius: enter a number such as 20 or 20.5"). |
| Readback required exact JSON equality. A value stored as float32 (for example 0.2 → 0.2000000029) produced "Verification Failed" and blocked the automatic refresh. | `FX.U.sameValue` uses a relative tolerance of 1e-5. Real rounding and clamping (70.4 → 70) still fail. When precision differs, the result notes the stored value. |
| Apply was the default button (`name: 'ok'`): Enter in a field submitted the batch, and another Enter in the confirmation applied it. | Apply is never the default. In the confirmation, Enter and Esc cancel. |
| Check for updates ran PowerShell even when After Effects blocked network access and could freeze for up to 10 s without warning. | It first checks the *Allow Scripts to Write Files and Access Network* preference, explains how to enable it, and warns about the possible pause. |
| Presets were edited as raw JSON, one parameter at a time. | Presets use the same fields as the editor, validate min/max, and accept several parameters per save. |
| The editor rebuilt the pending list and the layout on every keystroke. | The list is updated in place and layout only runs when visibility changes. |

## Apply performance (user feedback)

Reported symptom: every Apply took a long time, even for small changes.

Cause: after any successful operation, the panel invalidated the list, **relisted the whole scope** (the entire project, if chosen) in 12 ms slices, waiting for After Effects' `scheduleTask` between them, and only then reread the edited effects. This competed with After Effects redrawing the frame with the new value. In the batch, each target was fully captured (every property plus the fingerprint) twice: during prevalidation and again right before writing.

Changes:

| Before | Now |
|---|---|
| Relist the scope after set/copy/enable/disable | `Scanner.reuseAfterWrite` checks the effect stacks of the written layers and the targets' `enabled` state, and keeps the list. Edits reread only the edited effects. If anything does not match, or after Remove/Add Effect, the scope is relisted as before. |
| 2 full captures per target in the batch | 1 capture, plus a recapture only when an earlier write in the same batch touched the same layer (a plugin setter can change sibling effects; that case is still detected). In the mock with 3 effects on one layer, the logical clock drops from 72 to 60. |
| Clone every layer in the scope for each batch | Index only the target layers |
| 12 ms / 30-step slices, 25 ms delay | 40 ms / 150 steps, 10 ms delay |

## Interface

- **Two-pane editor:** searchable list on the left, parameter inspector on the right, pending changes at the bottom. The button shows the count ("Apply 3 changes").
- **Value entry (`FX.ValueInput`)**, shared by the editor and presets: X/Y/Z and R/G/B/A labels, a hex field, and a Pick... button using `$.colorPicker`.
- **Confirmation** with a Parameter / Current (effects) / New value table, a readable title ("Enable effects" instead of "enable"), and an "Apply to N effects" button.
- **Compact panel:** three rows at the top. Filters sits next to Scope, and Refresh and Cancel share the same spot.
- **Progress bar** while listing, reading, and applying.
- **Stable primary button:** it keeps "Edit Parameters..." and is disabled when there is nothing to edit (it used to turn into the message "Select an effect").
- **Consistent verbs:** More no longer repeats Enable/Disable/Add Effect/Issues. "Apply Effect..." became Add Effect..., "Copy Settings From..." became Copy From Another Effect..., and "Remove" became Remove Effects.
- **Messages without internal jargon** (inventory, occurrence, Basic, analysis), and a rewritten built-in Help.
- **Checkbox for on/off parameters.** ExtendScript does not report whether a parameter is a checkbox, so detection is conservative: the Checkbox Control, or a number without units, with a 0–1 range (or none), and every current value exactly 0 or 1. **Number...** switches to a numeric field if a slider at 0/1 is mistaken for a checkbox, and **Checkbox** switches back. The written value stays 0/1; pending changes and the confirmation show On/Off.
- **FXHX name** in the file, titles, Help, Diagnostics, Undo, and package. Data identifiers (`%APPDATA%\FXExchanger`, the JSON `product` fields, the script engine) are unchanged, so preferences and presets are preserved.
- **Portuguese:** labels, titles, and headers are translated when After Effects runs in Portuguese (`$.locale`) or with `FXHX_LANG=pt`. Logic uses the English keys (`fxTitle`/`fxKey`), so filters and tests do not depend on the language. Messages built from project data and the long Help text stay in English.
- **Row widths** are measured from the host font (`measureString`) instead of fixed 64/38 px, for high display scaling. The old values remain as a fallback.

## Architecture

- **`FX.Activity`** replaces the `busy` boolean with explicit phases (`idle`, `listing`, `reading`, `applying`) and checked transitions. Unexpected transitions are logged to Diagnostics but still applied, so the panel never gets stuck. `setWorking`/`setIdle` keep the phase and the Refresh/Cancel pair in sync.
- **Modules extracted from `panel.js`:** `FX.Confirmation` (pure batch description, testable without UI), `FX.Layout` (row geometry), `FX.HelpDialog`, `FX.ValueInput`, and `FX.I18N`. The hidden grouping dropdown became data (`groupBy.selection.index`), and the always-invisible "Parameters..." button was removed.
- **Release gate:** `npm run release` requires `docs/validation/ae-host-<version>.json` with every checklist item passing. `npm run release:candidate` builds a test package marked `hostValidated: false`.
- Per-version reports moved to `docs/history/`, with links updated.

## Intentionally unchanged

- The other reentrancy guards (`renderInProgress`, `selecting`, `viewSyncing`, `dialogs.length`, and so on) stay as they were. Each protects a case covered by a test, and replacing them without host validation would risk regressions that earlier hotfixes fixed. `FX.Activity` is the starting point for migrating them later.
- The `[x]`/`[-]` marks remain: they show the selection when the native highlight is not visible (inactive focus, themes), and the native highlight has not been validated in the host yet.
- Batch, revalidation, Undo, and post-write recovery contracts did not change.

## Pending in After Effects

Every item in the [checklist](HOST_SMOKE_CHECKLIST.md), especially: the two-pane editor and top-row layout at 100/150/200% display scaling, `measureString` in the real host, `$.colorPicker`, real color precision on readback, the confirmation's `defaultElement`, `$.locale` on Portuguese installations, and reading the network preference.
