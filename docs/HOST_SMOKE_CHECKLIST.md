# After Effects smoke test — required before every release

The Node tests use mocks. They do not prove ScriptUI layout, docking, keyboard behavior, display scaling, or real writes to a project. `npm run release` only builds the package when a passing record of this checklist exists for the exact version. For an unvalidated test build, use `npm run release:candidate` (its MANIFEST says `hostValidated: false`).

Estimated time: 30 to 40 minutes. Use **a copy** of a test project with:

- 3 layers with **Glow** (two with a static Radius of 100, one with Radius animated over 2 keys);
- 2 layers with an effect that has a **color** parameter (for example Fill or Tint);
- 1 text layer without effects.

## Checklist

Mark each item as `pass` or `fail` in the JSON record (template below).

| ID | Check |
|---|---|
| `install-and-open` | Delete the old `FX Exchanger.jsx`, copy `FXHX.jsx` to `ScriptUI Panels`, restart After Effects, and open **Window > FXHX.jsx**. The panel opens without dialogs and without listing effects, Help shows FXHX 0.1.16, and previously saved presets still appear under Presets.... |
| `search-and-select` | Type `glow` and press Enter: 3 effects are listed. Click, Ctrl-click, and Shift-click select as expected, with highlight and `[x]`. |
| `editor-two-pane-layout` | Edit Parameters opens with the list on the left and "Selected parameter" on the right. Resize the window: nothing is clipped and the list grows. Switch between a numeric parameter, a dropdown, and a color: the input stays visible. |
| `decimal-comma` | In Radius, type `12,5`: the pending change shows `12.5` and Apply writes 12.5. Type `abc`: a `!` appears with the message "enter a number". |
| `checkbox-parameter` | On effects with an on/off parameter (for example *Repeat Edge Pixels* in Gaussian Blur, or the Checkbox Control), the editor shows a checkbox with "Unchanged (now Off)". Checking it shows "Will set: On", the confirmation shows Off → On, and Effect Controls ends up checked. **Number...** switches to a numeric field and **Checkbox** switches back. A slider at 0 with a 0–100 range must **not** become a checkbox. |
| `apply-speed` | With Entire Project as the scope (a project with hundreds of layers), edit one parameter on 2–3 effects: the panel finishes within a few seconds without relisting the project (the status reads "Reading parameters", not "Listing effects"). Disabling one effect also finishes without relisting. Remove Effects still relists. |
| `color-hex-and-picker` | On a color parameter, the fields show R/G/B/A. Typing `#FF8000` in the hex field fills R=1, G=0.502, B=0. **Pick...** opens the system color picker and fills the fields. The applied value matches Effect Controls (and the result is "Written and Verified", not "Verification Failed"). |
| `apply-and-undo` | With two pending changes, the button reads "Apply 2 changes"; the confirmation has a Parameter / Current / New table and an "Apply to N effects" button. After applying, **one** Ctrl+Z undoes everything. |
| `enter-cancels-confirmation` | With the cursor in an editor field, Enter does **not** apply. In the confirmation, Enter closes it **without** applying (nothing changes in the project). |
| `keyframe-removal` | On the animated Glow, check "Remove keyframes" without a value: the confirmation asks for consent with the key count; after applying, Radius is static at its current value. Other parameters keep their keys. |
| `progress-and-cancel` | With Entire Project as the scope in a larger project, the progress bar appears while listing and Refresh turns into Cancel. Cancel stops the work; the bar disappears and Refresh returns. |
| `presets-multi-edit` | Save a Glow preset, open Presets > Edit values..., change two parameters (one with a decimal comma), and save: both are stored in the preset; the project does not change. |
| `dpi-100-150-200` | Repeat opening the panel and the editor with Windows display scaling at 100%, 150%, and 200%: button labels are not clipped and the top rows do not overlap. |
| `docked-resize-and-scroll` | With the panel docked in a narrow, short frame: a scrollbar appears, Page Up/Down work outside the list, and the list scrolls on its own. |
| `portuguese-locale` | With After Effects in Portuguese (or `FXHX_LANG=pt`), buttons and titles appear in Portuguese and the filters (Animated/Static) still work. With `FXHX_LANG=en`, everything returns to English. |
| `update-check` | Help > Check for updates with the After Effects network preference turned off: a message explains the preference, without freezing. With it turned on: a result within about 10 s. Open Releases opens the browser. |

## Record

Save it as `docs/validation/ae-host-<version>.json` and commit it with the release:

```json
{
  "product": "FXHX",
  "version": "0.1.16",
  "aeVersion": "26.5",
  "tester": "Name",
  "date": "2026-11-20",
  "checks": {
    "install-and-open": "pass",
    "search-and-select": "pass",
    "editor-two-pane-layout": "pass",
    "decimal-comma": "pass",
    "checkbox-parameter": "pass",
    "apply-speed": "pass",
    "color-hex-and-picker": "pass",
    "apply-and-undo": "pass",
    "enter-cancels-confirmation": "pass",
    "keyframe-removal": "pass",
    "progress-and-cancel": "pass",
    "presets-multi-edit": "pass",
    "dpi-100-150-200": "pass",
    "docked-resize-and-scroll": "pass",
    "portuguese-locale": "pass",
    "update-check": "pass"
  },
  "notes": ""
}
```

Any `fail` blocks the release. Describe the problem in `notes`, fix it, and run the checklist again.
