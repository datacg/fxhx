# User guide — FXHX 0.1.16

FXHX finds effects in your project and changes their parameters in batches, with a confirmation and a single Undo. The interface follows the language of After Effects; this guide uses the English labels.

## 1. Find effects

The top of the panel has three rows:

| Row | Controls |
|---|---|
| **Scope** | Active Composition, Choose Compositions, or Entire Project. **Filters...** narrows results by layer type, label, state, and animation. |
| **Find** | Type an effect, layer, or composition name and press **Enter**. The first search lists the effects in the scope; later searches filter that list instantly without reading the project again. |
| **View** | **Effects** (one per row), **Groups** (effects with the same values together), or **Layers** (includes layers without effects). **Presets...** and **Refresh/Scan** are here too. While a list is being built, **Cancel** takes the place of Refresh and a progress bar shows how far it got. |

Opening the panel reads nothing. Parameter values are read only when you ask for them (Edit Parameters or More > Read Parameters).

## 2. Select

- **Click** selects one result. **Ctrl-click** adds or removes. **Shift-click** selects a range; **Ctrl+Shift** adds a range.
- `[x]` marks selected rows and `[-]` a partially selected group.
- **Select Results** selects everything the search found, including other pages (long lists have pages of 200).
- Double-click a group (or use the Left/Right arrow keys) to collapse or expand it.
- Actions only use selected items that match the current search and filters. The summary line tells you when some selected items are hidden or on other pages.

## 3. Edit parameters

Select effects **of the same type** and click **Edit Parameters...**. The first time, the panel reads only the selected effects and then opens the editor.

**Left:** the parameter list, with search by name or value and the filter All parameters / Editable / Has keyframes / Pending changes / Unavailable. The *Applies to* column shows how many selected effects the change can reach (for example `3/3`).

**Right (Selected parameter):**

- the current value; when the effects have different values you see *Mixed Values* and a *Previous values* list with counts, for example `200 (1); 100 (1)`;
- **New value**: leave it blank to keep each effect's own value. Decimal commas are accepted (`12,5`). Invalid text is marked with `!` and a message;
- vectors show **X/Y/Z** fields; colors show **R/G/B/A from 0 to 1**, a **hex** field (`#FF8000`), and **Pick...** for the system color picker;
- dropdowns show their options by name, with *Keep original values* at the top;
- on/off parameters show a **checkbox** with the current state ("Unchanged (now Off)"). Click it to set every selected effect. **Number...** switches to a numeric field and **Checkbox** switches back, in case a slider that happens to sit at 0 or 1 is mistaken for a checkbox;
- **View targets** lists each composition/layer/effect, its current value, and why a target is blocked.

**Bottom:** every pending change, including those hidden by the search. Click one to jump back to it. `*` marks a pending change and `!` a value to fix. **Clear this change** and **Clear all changes** only discard what has not been applied yet.

**Apply N changes** sends everything as one batch. The confirmation shows a *Parameter / Current (effects) / New value* table and an **Apply to N effects** button. **Enter in the confirmation cancels**, so applying always takes a click. After applying, the list is kept and only the edited effects are read again (Remove Effects and Add Effect rebuild the list); click Edit Parameters to continue.

Each pending change must reach **every** selected effect. If a target has an expression, a locked layer, keyframes you have not authorized, or a missing parameter, Apply is blocked and View targets explains why. Adjust the selection or clear that change.

**Example:** search `lumetri`, Select Results, Edit Parameters, choose *Vibrance*, type `20`, Apply 1 change, Apply to N effects. Only Vibrance changes; exposure, saturation, and every other value of each effect stay as they were.

## 4. Keyframes

Keyframes are preserved by default. To replace an animated parameter with a fixed value, check **Remove keyframes (all selected effects)** on that parameter:

- with a new value, every effect receives that fixed value;
- with the field blank, each effect keeps its current value, now without keys.

The confirmation asks for a second consent that shows the key count. Other parameters keep their animation. **More > Inspect Animation...** shows times, values, and curves, read-only.

## 5. Copy and presets

- **More > Copy Parameters...** stores chosen static values; select effects of the same type and use **Paste Parameters...**.
- **Copy From Another Effect...** applies the values of a reference effect.
- **Save Effect Preset...** stores chosen values of one effect. In **Presets...** you can edit several values at once (with the same fields as the editor), rename, delete, import, and export. Editing a preset does not change the project.
- **Add Effect... > Saved presets** creates a **new** effect with those values; existing effects are not replaced.

Presets never contain keyframes, expressions, or internal data. The file is `%APPDATA%\FXExchanger\presets.json`, with automatic backups.

## 6. Other actions

On the panel: **Enable/Disable** (the effect's Enabled switch), **Add Effect...** (select a layer; use View > Layers for layers without effects), and **Locate** (selects the layer in the Timeline).

Under **More...**: Read Parameters, Copy/Paste Parameters, Compare..., Inspect Animation..., Remove Effects, Selection..., Grouping..., Details..., and Diagnostics....

## 7. Results and safety

Every operation is **one** Undo step (Ctrl+Z). Before writing, every target is checked again; afterward, each value is read back. **Results...** shows what happened to each target:

| Result | Meaning |
|---|---|
| Written and Verified | Written and confirmed. If After Effects stored the number at its own precision (common with colors), that is accepted and noted. |
| Written but Verification Failed | Written, but the value read back is different (rounded or clamped by the effect). |
| Skipped | Nothing was attempted on that parameter (for example, animated without authorization). |
| Failed Before Write | Failed before writing; nothing changed. |
| Unknown After Host Error | After Effects reported an error during the write; the value may have changed. |

Uncertain writes are never retried automatically: check Effect Controls, press Ctrl+Z if needed, and click Refresh before trying again.

**Protected fields:** After Effects Compositing Options, Effect Opacity, GPU Rendering, Connection Timestamp, and other internal fields do not appear in the editor and are never written. In AI Color Match, only *Intensity* is editable. Opaque graphical controls (some curves) are blocked; edit them in the effect itself. ExtendScript does not report universally which fields a plugin displays, so some third-party plugins may need specific rules.

## 8. Troubleshooting

- After Effects may stop responding during long operations; the progress bar shows how far it got. Cancel cannot interrupt a host call that is already running.
- **Help > Check for updates** needs the *Allow Scripts to Write Files and Access Network* preference and may pause After Effects for a few seconds. **Open Releases** always works.
- **Help > Diagnostics...** creates a technical log for bug reports, without project values or license data.

Installation and common problems: [INSTALL.md](INSTALL.md).
