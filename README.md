![FXHX — A game changer for After Effects.](assets/fxhx-cover.png)

# FXHX

**A game changer for After Effects.**

Find, compare, and batch-edit effect parameters in Adobe After Effects.

**FXHX** is an ExtendScript/ScriptUI panel for Windows. Search for an effect (say, every Glow in the project), select the instances you want, set new values for one or more parameters, and apply them all at once, with a confirmation and a single Undo.

## Download and installation

Download the [latest release](https://github.com/datacg/fxhx/releases/latest) and extract `FXHX.jsx` from the ZIP.

1. Close the panel if it is already open. **Upgrading from 0.1.15?** Delete the old `FX Exchanger.jsx`; otherwise the Window menu lists two panels. Your preferences and presets are kept.
2. Copy `FXHX.jsx` to the `Scripts/ScriptUI Panels` folder in your After Effects installation.
3. Restart After Effects and open **Window → FXHX.jsx**. Check the installed version in **Help**.

You do not need Node.js or npm to use the panel. See the [installation instructions](INSTALL.md).

## How to use it

1. **Find.** Choose a scope, type a name (for example `glow`) and press Enter.
2. **Select.** Click an effect; **Ctrl** toggles individual selections and **Shift** selects a range. *Select Results* selects everything found.
3. **Edit.** Click **Edit Parameters...**. Pick a parameter on the left and enter the new value on the right; repeat for other parameters. Blank fields keep each effect's own value.
4. **Apply.** Click **Apply N changes**, review the table of current and new values, and click **Apply to N effects**. Enter in the confirmation cancels, so applying always takes a click.

The editor adapts to each parameter: X/Y/Z fields for vectors, R/G/B/A plus a hex field and the system color picker for colors, named options for dropdowns, and a checkbox for on/off parameters. Decimal commas (`12,5`) are accepted. When values differ, the editor shows **Mixed Values** and lists each value with its effect count, for example **200 (1) and 100 (1) → 150 for both**.

You can also compare settings, copy selected static parameters, save presets for an individual effect, and enable or disable selected effects. See the [user guide](USER_GUIDE.md).

The interface follows After Effects' language: Portuguese labels when AE runs in Portuguese, English otherwise. Set the environment variable `FXHX_LANG=en` or `FXHX_LANG=pt` to choose.

## Keyframes, safety and updates

Keyframes are preserved by default. To remove them from a parameter, check **Remove keyframes** and confirm the key count. Leave the new value blank to keep each effect's current value, or enter a value to replace all of them. Expressions, locked layers and unsupported controls remain protected.

Every operation is checked again before writing, read back after writing, and undone in one step. After an edit, the panel keeps the effect list and rereads only the edited effects, so applying stays quick even with the whole project in scope.

Under **Help → Check for updates**, the panel checks this repository's latest stable release (it needs AE's *Allow Scripts to Write Files and Access Network* preference). **Open Releases** opens the download page. Update checks are manual, do not send project data, and do not install anything automatically.

## Release status

The current version is **0.1.16**. It has **282 passing automated tests**, ES3 build validation, and package verification. Validation inside After Effects follows the [host checklist](docs/HOST_SMOKE_CHECKLIST.md). See [VALIDATION.md](VALIDATION.md) and the [0.1.16 changes](docs/CHANGES_0.1.16.md).

Host API failures can leave partial changes. Review **Results** before repeating an operation; the panel does not automatically retry uncertain writes. Compatibility with private third-party plugin controls depends on what each effect exposes.

## Support development

FXHX is free to use. If it makes your work easier, you can make a voluntary contribution to support its development and other free DATACG projects.

**[Support DATACG on Ko-fi](https://ko-fi.com/datacg)**

## Development

Requires Node.js 18 or later. On Windows:

```powershell
npm.cmd ci
npm.cmd run check              # build + tests
npm.cmd run release:candidate  # test package, marked as not validated in AE
npm.cmd run release            # requires docs/validation/ae-host-<version>.json
```

Source files are in `src/`; the build generates `dist/FXHX.jsx`. Distribution packages are created in `release/`. These commands do not launch After Effects. [Testing](TESTING.md) · [Architecture](ARCHITECTURE.md) · [Changelog](CHANGELOG.md).

Found a problem? [Open an issue](https://github.com/datacg/fxhx/issues) with the panel version, After Effects version, and steps to reproduce it. **Help → Diagnostics...** saves a technical log without project values; remove personal paths before sharing.
