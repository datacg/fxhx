const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');
const installed = require('../package.json').version;
const payload = tag => JSON.stringify({ tag_name: tag,
    html_url: 'https://github.com/datacg/fxhx/releases/tag/' + tag, draft: false, prerelease: false });

test('release versions compare numerically and match the package version', () => {
    const { FX } = fixture();
    assert.equal(FX.Updates.installed, installed);
    assert.equal(FX.Updates.compare('v0.1.15', '0.1.9'), 1);
    assert.equal(FX.Updates.compare('0.2.0', '0.10.0'), -1);
    assert.equal(FX.Updates.compare('1.0.0', '0.99.999'), 1);
    assert.equal(FX.Updates.compare('v0.1.15', installed), 0);
    for (const tag of ['', 'v01.1.0', '1.2', '1.2.3-beta.1', '1.2.3;Start-Process bad', null]) {
        assert.throws(() => FX.Updates.version(tag), /Invalid release version/);
    }
});

test('only published stable releases from datacg/fxhx are accepted as update data', () => {
    const { FX } = fixture();
    assert.deepEqual(plain(FX.Updates.release(payload('v0.1.16'), installed)), {
        available: true, version: '0.1.16', url: 'https://github.com/datacg/fxhx/releases/tag/v0.1.16'
    });
    assert.equal(FX.Updates.release(payload('v0.1.15'), installed).available, false);
    assert.equal(FX.Updates.release(payload('v0.1.9'), installed).available, false);
    for (const patch of [{ draft: true }, { prerelease: true }, { draft: null },
        { html_url: 'https://github.com/other/repo/releases/tag/v0.1.16' },
        { html_url: 'https://github.com/datacg/fxhx/releases/tag/v0.1.16?x=bad' },
        { tag_name: 'v0.1.16"; malicious' }]) {
        assert.throws(() => FX.Updates.release(JSON.stringify({ ...JSON.parse(payload('v0.1.16')), ...patch }), installed));
    }
    for (const text of ['null', '{}', '<html>offline</html>', 'x'.repeat(8193)]) {
        assert.throws(() => FX.Updates.release(text, installed));
    }
});

test('update transport uses a fixed HTTPS endpoint, a timeout and no project data or policy bypass', () => {
    const commands = [], h = fixture({ system: { callSystem(command) { commands.push(command); return payload('v0.1.16'); } } });
    assert.equal(commands.length, 0);
    assert.equal(h.adapter.checkForUpdates(installed).available, true);
    assert.equal(commands.length, 1);
    assert.match(commands[0], /https:\/\/api.github.com\/repos\/datacg\/fxhx\/releases\/latest/);
    assert.match(commands[0], /-TimeoutSec 10/);
    assert.match(commands[0], /-MaximumRedirection 0/);
    assert.match(commands[0], /-WindowStyle Hidden/);
    assert.doesNotMatch(commands[0], /ExecutionPolicy|DownloadFile|OutFile|setValue|Authorization|eval\(/i);
    h.adapter.openReleases();
    assert.match(commands[1], /Start-Process 'https:\/\/github.com\/datacg\/fxhx\/releases\/latest'/);
    assert.equal(h.calls.length, 0);
});

test('unavailable transport, no release, network failures and malformed responses are distinct from up to date', () => {
    assert.throws(() => fixture().adapter.checkForUpdates(installed), /unavailable/);
    for (const response of ['', 'FXHX_UPDATE_ERROR', 'HTTP 403', '<html>error</html>']) {
        const h = fixture({ system: { callSystem() { return response; } } });
        assert.throws(() => h.adapter.checkForUpdates(installed));
    }
    const h = fixture({ system: { callSystem() { return 'FXHX_NO_RELEASE\r\n'; } } });
    assert.deepEqual(plain(h.adapter.checkForUpdates(installed)), { unpublished: true });
});

test('opening the panel and Help never checks the network; clicking checks and opens releases independently', () => {
    const commands = [], h = ui({ hostGlobals: { system: { callSystem(cmd) { commands.push(cmd); return payload('v0.1.16'); } } } });
    const panel = h.start();
    assert.equal(commands.length, 0);
    h.dialogHooks['FX Exchanger Help'] = d => {
        assert.equal(commands.length, 0);
        h.click(d, 'Check for updates');
        const status = h.all(d, 'statictext').find(c => c.fxUpdateStatus);
        assert.match(status.text, /Update available: 0.1.16/);
        assert.equal(commands.length, 1);
        h.click(d, 'Open Releases');
        assert.equal(commands.length, 2);
        h.click(d, 'Close');
    };
    h.click(panel, 'Help');
    assert.equal(commands.length, 2);
    assert.equal(h.calls.length, 0);
    assert.equal(h.alerts.length, 0);
});

test('failed checks remain retryable, ignore reentry and preserve offline help and diagnostics', () => {
    const h = ui(), panel = h.start(); let calls = 0;
    h.dialogHooks['FX Exchanger Help'] = d => {
        const check = h.all(d, 'button').find(b => b.text === 'Check for updates');
        h.adapter.checkForUpdates = () => { calls++; check.onClick(); throw Error('Network offline'); };
        h.click(d, 'Check for updates');
        const status = h.all(d, 'statictext').find(c => c.fxUpdateStatus);
        assert.match(status.text, /Could not check/);
        assert.equal(check.enabled, true);
        assert.equal(calls, 1);
        h.adapter.checkForUpdates = () => ({ version: installed, available: false });
        h.click(d, 'Check for updates'); assert.match(status.text, /up to date/);
        h.adapter.checkForUpdates = () => ({ unpublished: true });
        h.click(d, 'Check for updates'); assert.match(status.text, /No published release/);
        h.click(d, 'Diagnostics...');
    };
    h.click(panel, 'Help');
    assert.match(h.adapter.diagnostics.text(), /check-updates/);
    assert.equal(h.calls.length, 0);
    assert.equal(h.alerts.length, 0);
});
