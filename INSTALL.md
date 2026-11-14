# Installation — FXHX 0.1.16

## Dockable panel (recommended)

1. Close the panel if it is open, and keep a copy of the previous JSX if you have one.
2. Copy `FXHX.jsx` (from the release ZIP or from `dist/`) to:
   `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   Writing to Program Files may require administrator permission.
3. Restart After Effects. If it was already running, save your work first: the script engine can keep the previous version in memory until a restart.
4. Open **Window > FXHX.jsx** and dock the panel wherever you like.
5. Check the version in **Help**: it should show 0.1.16.

## Upgrading from "FX Exchanger" (0.1.15 and earlier)

The file is now named `FXHX.jsx`. **Delete the old `FX Exchanger.jsx`** from `ScriptUI Panels`; otherwise the Window menu lists both panels. Preferences and presets stay in `%APPDATA%\FXExchanger\` and are picked up automatically.

## Run once without installing

Choose **File > Scripts > Run Script File...** and select the JSX. It opens as a floating window. To dock it, install it as described above.

## After Effects preferences

- **Check for updates** requires *Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network*. Without it, the panel explains what to enable, and **Open Releases** still works. The check may pause After Effects for a few seconds.
- Presets and preferences also need write permission. They are stored in `%APPDATA%\FXExchanger\` (`state.json` and `presets.json`, with automatic backups).

## Language

The interface follows the language of After Effects. To force a language, set the environment variable `FXHX_LANG=en` or `FXHX_LANG=pt` and restart After Effects.

## Troubleshooting

| Symptom | What to do |
|---|---|
| The panel does not appear under Window | Make sure the file is in `ScriptUI Panels` (not `Scripts`) and restart After Effects. |
| Help still shows an older version | Restart After Effects; the script engine keeps the previous script. |
| "Network access is off" | Enable the scripting preference above, or use Open Releases. |
| An operation reports "Unknown" or "Verification Failed" | Open **Results...**, check the values in Effect Controls, press Ctrl+Z if needed, and click **Refresh** before trying again. The panel never retries uncertain writes on its own. |
| You need to report a problem | **Help > Diagnostics...** saves a technical log without project values or license data. Review file paths before sharing it. |

## Uninstall

Delete `FXHX.jsx` from `ScriptUI Panels` and, optionally, the `%APPDATA%\FXExchanger\` folder.
