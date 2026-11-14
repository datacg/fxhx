// Help, version and update checks. Receives ScriptUI factories from the
// panel (like FX.Editor), so it never touches panel state directly.
FX.HelpDialog = (function () {
    // Returns true when the person asked to open Diagnostics next.
    function open(ui) {
        var d = ui.createDialog(FX.I18N.t('FXHX Help')),
            adapter = ui.adapter,
            diagnostics = ui.diagnostics,
            row = ui.row,
            button = ui.button;
        var installedVersion = FX.Updates.installed;
        d.add('statictext', undefined, 'FXHX ' + installedVersion);
        d.orientation = 'column';
        d.alignChildren = 'fill';
        var index = ui.dropdown(d, []),
            i;
        for (i = 0; i < FX.Presentation.help.length; i++) {
            index.add('item', FX.Presentation.help[i][0]);
        }
        var text = d.add('edittext', undefined, '', {
            multiline: true,
            scrolling: true,
            readonly: true
        });
        text.preferredSize = [440, 300];
        index.onChange = function () {
            if (index.selection) {
                text.text = FX.Presentation.help[index.selection.index][1];
            }
        };
        index.selection = 0;
        index.onChange();
        var updateStatus = d.add('statictext', undefined, FX.I18N.t('Check GitHub for a newer version. Only runs when you click Check for updates.'), { multiline: true });
        updateStatus.preferredSize = [440, 42];
        updateStatus.fxUpdateStatus = true;
        var updateActions = row(d), checkingUpdates = false,
            checkUpdates = button(updateActions, 'Check for updates', function () {
                if (checkingUpdates || ui.disposed()) { return; }
                checkingUpdates = true;
                checkUpdates.enabled = false;
                updateStatus.text = 'Checking GitHub... After Effects may pause for up to 10 seconds.';
                try {
                    d.update();
                } catch (ignoredUpdatePaint) {}
                try {
                    var release = adapter.checkForUpdates(installedVersion);
                    if (release.unpublished) {
                        updateStatus.text = 'No published release is available yet. Installed: ' + installedVersion + '.';
                    } else if (release.available) {
                        updateStatus.text = 'Update available: ' + release.version + ' (installed: ' + installedVersion + '). Open Releases to download it.';
                    } else {
                        updateStatus.text = 'You are up to date. Installed: ' + installedVersion + '; latest release: ' + release.version + '.';
                    }
                } catch (updateError) {
                    updateStatus.text = adapter.networkAllowed && adapter.networkAllowed() === false ?
                        'Network access is off. Enable Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network, or open Releases.' :
                        'Could not check for updates. Check your connection or open Releases in your browser.';
                    diagnostics.error('check-updates', updateError);
                } finally {
                    checkingUpdates = false;
                    checkUpdates.enabled = true;
                }
            });
        button(updateActions, 'Open Releases', function () {
            try { adapter.openReleases(); }
            catch (browserError) { updateStatus.text = 'Open https://github.com/datacg/fxhx/releases in your browser.'; }
        });
        var openDiagnostics = false;
        button(d, 'Diagnostics...', function () {
            openDiagnostics = true;
            d.close(1);
        });
        button(d, 'Close', function () {
            d.close(0);
        });
        ui.showDialog(d);
        return openDiagnostics;
    }
    return { open: open };
})();
