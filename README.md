![FXHX — A game changer for After Effects.](assets/fxhx-cover.png)

# FXHX

**A game changer for After Effects.**

Find, compare, and batch-edit effect parameters in Adobe After Effects.

**FXHX (FX Exchanger)** is an ExtendScript/ScriptUI panel for Windows. Select the effect instances you want to edit, review their current values, and prepare several changes to apply in one batch.

## Download and installation

Download the [latest release](https://github.com/datacg/fxhx/releases/latest) and extract `FX Exchanger.jsx` from the ZIP. You can also download the JSX file separately from the same page. GitHub names the standalone download `FX.Exchanger.jsx`; rename it to `FX Exchanger.jsx` before installing it.

1. Close the panel if it is already open.
2. Copy `FX Exchanger.jsx` to the `Scripts/ScriptUI Panels` folder in your After Effects installation.
3. Open **Window → FX Exchanger.jsx**. Check the installed version in **Help**.

You do not need Node.js or npm to use the panel. See the [installation instructions](INSTALL.md).

## How to use it

1. Choose a scope and use **Search** or **Scan** to find effects.
2. Select the instances you want to edit. **Ctrl** toggles individual selections; **Shift** selects a range.
3. Click **Edit Parameters...**. Search for parameters and enter only the values you want to change.
4. Review the previous values, pending changes, and targets. Click **Apply** to confirm and apply the batch.

When values differ, the editor displays **Mixed Values** and lists each previous value with its effect count. For example: **200 (1 effect) + 100 (1 effect) → 150 for both**. Every pending change must cover all selected effects. If a known issue prevents that, Apply is disabled and the editor explains why.

You can also compare settings, copy selected static parameters, save presets for an individual effect, and enable or disable selected effects. See the [user guide](USER_GUIDE.md).

## Keyframes and updates

Keyframes are preserved by default. To remove them from a parameter, select **Remove keyframes** and confirm the removal. This also works with a single keyframe: leave the new value blank to keep each effect's current value, or enter a value to replace all selected values. Expressions and unsupported controls remain protected.

Under **Help → Check for updates**, the panel checks this repository's latest stable release. **Open Releases** opens the download page. Update checks are manual, do not send project data, and do not install updates automatically.

## Release status

This is the first public release, **0.1.15**. It has **253 passing automated tests**, ES3 build validation, and package verification. Visual and functional validation inside After Effects is still pending. See [VALIDATION.md](VALIDATION.md) and the [manual testing checklist](docs/UI_QA.md).

Host API failures can leave partial changes. Review **Results** before repeating an operation; the panel does not automatically retry uncertain writes. Compatibility with private third-party plugin controls depends on what each effect exposes.

## Support development

FXHX is free to use. If it makes your work easier, you can make a voluntary contribution to support its development and other free DATACG projects.

**[Support DATACG on Ko-fi](https://ko-fi.com/datacg)**

## Development

Requires Node.js 18 or later. On Windows:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run release
```

Source files are in `src/`; the build generates `dist/FX Exchanger.jsx`. Distribution packages are created in `release/`. These commands do not launch After Effects. [Testing](TESTING.md) · [Architecture](ARCHITECTURE.md) · [Changelog](CHANGELOG.md).

Found a problem? [Open an issue](https://github.com/datacg/fxhx/issues) with the panel version, After Effects version, and steps to reproduce it. Remove personal or project data before sharing logs.
