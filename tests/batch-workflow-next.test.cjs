const test = require('node:test'),
    assert = require('node:assert/strict');
const { ui, nodes } = require('./ui-harness.cjs');
const { plain } = require('./helpers.cjs');
function analyzed(h, p) {
    h.scan(p);
    h.click(p, 'Select Results');
    h.read(p);
    h.drain(p);
    const mode = h.all(p, 'dropdownlist')[1];
    mode.selection = 7;
    mode.onChange();
    h.click(p, 'Clear Selection');
}
function storage() {
    let doc = {
        schemaVersion: 1,
        product: 'FX Exchanger Presets',
        presets: []
    };
    return {
        load: () => plain(doc),
        save: (value) => (doc = plain(value)),
        document: () => doc
    };
}
function copyHooks(h) {
    h.dialogHooks['Copy Parameters'] = (d) => h.click(d, 'Choose source');
    h.dialogHooks['Choose parameters to copy'] = (d) => {
        h.all(d, 'listbox')[0].items[0].selected = true;
        h.click(d, 'Use selected');
    };
}

test('View keeps configuration Groups central, Layer last, and never opens dialogs on change', () => {
    const h = ui({ selectionNotifications: 'always' }),
        p = h.start();
    const view = h.all(p, 'dropdownlist')[2];
    assert.deepEqual(
        view.items.map((x) => x.text),
        ['Effects', 'Groups', 'Layer']
    );
    for (const index of [1, 2, 0, 1]) {
        view.selection = index;
        view.onChange();
    }
    assert.equal(h.windows.length, 0);
    assert.equal(h.tasks.size, 0);
    assert.equal(h.notifications.overflow, 0);
});

test('Ctrl toggles individual results and Shift selects a range with persistent marks and exact batch targets', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    h.scan(p);
    const tree = h.results(p);
    h.pick(p, tree.items[0]);
    h.pick(p, tree.items[3], { ctrlKey: true });
    assert.equal(p.fxController.selected().instances.length, 2);
    assert.ok(tree.items[0].text.startsWith('[x] '));
    assert.ok(tree.items[3].text.startsWith('[x] '));
    h.pick(p, tree.items[0], { ctrlKey: true });
    assert.equal(p.fxController.selected().instances.length, 1);
    h.pick(p, tree.items[1]);
    h.pick(p, tree.items[4], { shiftKey: true });
    assert.equal(p.fxController.selected().instances.length, 4);
    h.pick(p, tree.items[2], { ctrlKey: true });
    assert.equal(p.fxController.selected().instances.length, 3);
    tree.onChange();
    tree.control.listener_click({ ctrlKey: true });
    assert.equal(p.fxController.selected().instances.length, 3);
    h.click(p, 'Disable');
    h.drain(p);
    for (let i = 0; i < 18; i++)
        assert.equal(
            c.layers[i].parade.property(1).enabled,
            ![1, 3, 4].includes(i)
        );
    assert.match(h.confirmations.at(-1), /3 effects \/ 3 layers/);
});

test('Ctrl subtracts one occurrence from a selected configuration group and marks parents partially selected', () => {
    const h = ui({ grouped: true }),
        c = h.glow(),
        p = h.start();
    h.analyzed(p);
    const tree = h.results(p),
        group = nodes(tree).find(
            (n) => n.fxGroup && n.fxGroup.instances.length === 12
        );
    h.pick(p, group);
    const excluded = nodes(group).find((n) => n.fxLeaf),
        record = excluded.fxData.instances[0];
    h.pick(p, excluded, { ctrlKey: true });
    assert.equal(p.fxController.selected().instances.length, 11);
    assert.ok(group.text.startsWith('[-] '));
    assert.ok(excluded.text.startsWith('[ ] '));
    h.click(p, 'Disable');
    h.drain(p);
    assert.equal(
        c.layers.find((l) => l.id === record.layerId).parade.property(1)
            .enabled,
        true
    );
    assert.equal(
        c.layers.filter((l) => !l.parade.property(1).enabled).length,
        11
    );
});

test('filtered-out manual selections remain excluded from writes', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    h.scan(p);
    const tree = h.results(p);
    h.pick(p, tree.items[0]);
    h.pick(p, tree.items[17], { ctrlKey: true });
    const q = h.all(p, 'edittext')[0];
    q.text = 'Text';
    q.onChanging();
    h.click(p, 'Search');
    assert.equal(p.fxController.selected().instances.length, 1);
    h.click(p, 'Disable');
    h.drain(p);
    assert.equal(c.layers[0].parade.property(1).enabled, false);
    assert.equal(c.layers[17].parade.property(1).enabled, true);
});

test('decorative names use technical identities in results without changing original names', () => {
    const h = ui({ grouped: true }),
        c = h.comp(),
        l = c.addLayer(),
        e = l.parade.addProperty('ADBE Glo2');
    e.name = '_____________';
    const p = h.start();
    h.scan(p);
    const tree = h.results(p);
    assert.match(tree.items[0].text, /ADBE Glo2/);
    assert.equal(
        p.fxController.scanner.basic.instances[0].effectName,
        '_____________'
    );
    const mode = h.all(p, 'dropdownlist')[1];
    mode.selection = 7;
    mode.onChange();
    assert.match(tree.items[0].text, /ADBE Glo2/);
    assert.equal(e.name, '_____________');
});

test('copy/paste parameters uses a frozen source and only the manually selected destinations', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    analyzed(h, p);
    copyHooks(h);
    const tree = h.results(p);
    h.pick(p, tree.items[3]);
    h.more(p, 'Copy Parameters...');
    c.layers[3].parade.property(1).property(1).value = 8;
    h.pick(p, tree.items[16]);
    h.pick(p, tree.items[17], { ctrlKey: true });
    h.more(p, 'Paste Parameters...');
    h.drain(p);
    assert.equal(c.layers[16].parade.property(1).property(1).value, 6);
    assert.equal(c.layers[17].parade.property(1).property(1).value, 6);
    assert.equal(c.layers[15].parade.property(1).property(1).value, 7);
    assert.equal(c.layers[3].parade.property(1).property(1).value, 8);
    assert.ok(
        c.layers.every((l) => l.parade.property(1).property(2).value === 80)
    );
    assert.equal(h.calls.filter((c) => c[0] === 'set').length, 2);
    assert.equal(h.alerts.length, 0);
});

test('auto Refresh preserves Results and rereads only the safe selection after Apply', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    analyzed(h, p);
    const tree = h.results(p);
    h.pick(p, tree.items[17]);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const f = h.parameterFields(d)[0];
        f.text = '11';
        f.onChanging();
        h.click(d, 'Apply');
    };
    const old = p.fxController.scanner.basic;
    h.click(p, 'Edit Parameters...');
    const report = p.fxController.batch.lastReport;
    const capture = h.adapter.capture;
    let reads = 0;
    h.adapter.capture = function (effect, ...args) {
        assert.equal(effect, c.layers[17].parade.property(1));
        reads++;
        return capture.call(this, effect, ...args);
    };
    h.drain(p);
    assert.notEqual(p.fxController.scanner.basic, old);
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.equal(report.verified, 1);
    assert.equal(c.layers[17].parade.property(1).property(1).value, 11);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(reads, 1);
    assert.equal(p.fxController.selected().instances[0].configuration.properties[0].value, 11);
    assert.ok(h.all(p, 'button').some(b => b.text === 'Edit Parameters...' && b.enabled));
    assert.ok(
        h.all(p, 'button').some((b) => b.text === 'Results...' && b.enabled)
    );
    assert.equal(h.alerts.length, 0);
});

test('uncertain writes never trigger automatic Refresh or another write', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    analyzed(h, p);
    h.pick(p, h.results(p).items[0]);
    const prop = c.layers[0].parade.property(1).property(1);
    prop.setValue = () => {
        throw Error('Host error after invocation');
    };
    let scans = 0;
    h.adapter.scanCursor = () => {
        scans++;
        throw Error('Must not auto refresh');
    };
    h.dialogHooks['Edit Parameters'] = (d) => {
        const f = h.parameterFields(d)[0];
        f.text = '8';
        f.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(p.fxController.batch.lastReport.unknown, 1);
    assert.equal(scans, 0);
    assert.equal(h.tasks.size, 0);
    assert.ok(
        h.all(p, 'button').some((b) => b.text === 'Results...' && b.enabled)
    );
});

test('save/edit/rename a preset operates on storage only and excludes unchosen parameters', () => {
    const store = storage(),
        h = ui({ presetStore: store });
    h.glow();
    const p = h.start();
    analyzed(h, p);
    copyHooks(h);
    h.pick(p, h.results(p).items[3]);
    h.dialogHooks['Save effect preset'] = (d) => {
        h.all(d, 'edittext')[0].text = 'Soft Glow';
        h.click(d, 'Save');
    };
    h.adapter.capture = () => {
        throw Error('Use existing snapshots');
    };
    h.more(p, 'Save Effect Preset...');
    assert.equal(store.document().presets[0].rows.length, 1);
    assert.equal(store.document().presets[0].omitted, 1);
    let step = 0;
    h.dialogHooks['Effect presets'] = (d) => {
        if (step++ === 0) h.click(d, 'Edit values...');
        else if (step === 2) h.click(d, 'Rename...');
        else h.click(d, 'Close');
    };
    h.dialogHooks['Edit preset'] = (d) => {
        h.all(d, 'edittext')[0].text = '9';
        h.click(d, 'Save preset');
    };
    h.dialogHooks['Rename preset'] = (d) => {
        h.all(d, 'edittext')[0].text = 'Glow 9';
        h.click(d, 'Save');
    };
    h.click(p, 'Presets...');
    assert.equal(store.document().presets[0].name, 'Glow 9');
    assert.equal(store.document().presets[0].rows[0].value, 9);
    assert.equal(h.calls.filter((c) => c[0] === 'set').length, 0);
    assert.equal(h.alerts.length, 0);
});

test('Add Effect offers saved presets and reports the created instance and verified parameters', () => {
    const store = storage(),
        h = ui({ presetStore: store });
    new h.FX.Presets.Library(store).save('Glow 12', 'ADBE Glo2', [
        {
            path: [{ matchName: 'Intensity', index: 1 }],
            name: 'Intensity',
            valueType: 'OneD',
            value: 12
        }
    ]);
    const c = h.comp(),
        l = c.addLayer(),
        p = h.start();
    h.scan(p);
    h.pick(
        p,
        nodes(h.results(p)).find((n) => n.fxLeaf)
    );
    h.dialogHooks['Choose effect to apply'] = (d) => {
        const kind = h.all(d, 'dropdownlist')[0];
        kind.selection = 1;
        kind.onChange();
        h.all(d, 'listbox')[0].selection = 0;
        h.click(d, 'Choose');
    };
    h.click(p, 'Add Effect...');
    h.drain(p);
    assert.equal(l.parade.numProperties, 1);
    assert.equal(l.parade.property(1).property(1).value, 12);
    const r = p.fxController.batch.lastReport;
    assert.equal(r.created, 1);
    assert.equal(r.changed, 1);
    assert.equal(r.verified, 1);
    assert.match(h.confirmations.at(-1), /NEW instance/);
    assert.equal(h.alerts.length, 0);
});

test('a failed preset write records the newly created effect, keeps uncertainty and never adds a duplicate', () => {
    const store = storage(),
        h = ui({ presetStore: store });
    new h.FX.Presets.Library(store).save('Glow', 'ADBE Glo2', [
        {
            path: [{ matchName: 'Intensity', index: 1 }],
            name: 'Intensity',
            valueType: 'OneD',
            value: 12
        }
    ]);
    const c = h.comp(),
        l = c.addLayer(),
        p = h.start();
    h.scan(p);
    h.pick(
        p,
        nodes(h.results(p)).find((n) => n.fxLeaf)
    );
    const add = h.adapter.addEffect;
    h.adapter.addEffect = function (...args) {
        const e = add.apply(this, args);
        e.property(1).setValue = () => {
            throw Error('uncertain setter');
        };
        return e;
    };
    h.dialogHooks['Choose effect to apply'] = (d) => {
        const kind = h.all(d, 'dropdownlist')[0];
        kind.selection = 1;
        kind.onChange();
        h.all(d, 'listbox')[0].selection = 0;
        h.click(d, 'Choose');
    };
    h.click(p, 'Add Effect...');
    const r = p.fxController.batch.lastReport;
    assert.equal(r.created, 1);
    assert.equal(r.changed, 1);
    assert.equal(r.unknown, 1);
    assert.equal(r.failed, 1);
    assert.equal(l.parade.numProperties, 1);
    assert.equal(h.tasks.size, 0);
    assert.equal(p.fxController.scanner.basic.stale, true);
});

test('selection label failures block mutations and offer presentation recovery', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const item = h.results(p).items[0],
        label = item.text;
    Object.defineProperty(item, 'text', {
        get: () => label,
        set() {
            throw Error('Native label failure');
        }
    });
    h.pick(p, item);
    assert.ok(
        h.all(p, 'button').some((b) => b.text === 'Retry display' && b.enabled)
    );
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Disable').enabled,
        false
    );
    assert.equal(
        h.calls.filter((c) => c[0] === 'set' || c[0] === 'remove').length,
        0
    );
});

test('programmatic mark notifications cannot move focus or change the selected work targets', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p),
        first = tree.items[0],
        other = tree.items[1];
    let text = first.text;
    Object.defineProperty(first, 'text', {
        get: () => text,
        set(value) {
            text = value;
            tree.selection = other;
            tree.onChange();
        }
    });
    h.pick(p, first);
    tree.onChange();
    tree.control.listener_click({});
    assert.equal(tree.selection, first);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(p.fxController.selected().instances[0].layerName, 'Text 0');
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Disable').enabled,
        true
    );
    assert.equal(h.alerts.length, 0);
});

test('preset import/export dialogs move only validated JSON data through explicitly chosen files', () => {
    let incoming,
        outgoing = '';
    class Folder {
        constructor(path) {
            this.fsName = path;
        }
    }
    Folder.userData = { fsName: '/mock-user' };
    class File {}
    File.openDialog = () => ({
        exists: true,
        length: incoming.length,
        open: () => true,
        read: () => incoming,
        close() {},
        error: ''
    });
    File.saveDialog = () => ({
        open: () => true,
        write(text) {
            outgoing = text;
            return true;
        },
        close() {},
        error: ''
    });
    const store = storage(),
        h = ui({ presetStore: store, hostGlobals: { File, Folder } });
    const source = new h.FX.Presets.Library(null);
    source.save('Imported Glow', 'ADBE Glo2', [
        {
            path: [{ matchName: 'Intensity', index: 1 }],
            name: 'Intensity',
            valueType: 'OneD',
            value: 10
        }
    ]);
    incoming = source.exportText();
    const p = h.start();
    let step = 0;
    h.dialogHooks['Effect presets'] = (d) => {
        if (step++ === 0) h.click(d, 'Import presets...');
        else if (step === 2) h.click(d, 'Export all presets...');
        else h.click(d, 'Close');
    };
    h.click(p, 'Presets...');
    assert.deepEqual(JSON.parse(outgoing), JSON.parse(incoming));
    assert.equal(store.document().presets[0].name, 'Imported Glow');
    assert.equal(h.calls.length, 0);
    assert.equal(h.tasks.size, 0);
    assert.equal(h.alerts.length, 0);
});

test('the keyframe table lists values/times/curves on explicit inspection and never modifies animation', () => {
    const KeyframeInterpolationType = { LINEAR: 1, HOLD: 2, BEZIER: 3 };
    const h = ui({ hostGlobals: { KeyframeInterpolationType } }),
        c = h.comp(),
        l = c.addLayer();
    const animated = h.prop('Animated', 0, 'OneD', { numKeys: 2 });
    let reads = 0;
    animated.keyTime = (k) => {
        reads++;
        return k - 1;
    };
    animated.keyValue = (k) => 10 * k;
    animated.keyInInterpolationType = animated.keyOutInterpolationType = () =>
        3;
    animated.keyInTemporalEase = animated.keyOutTemporalEase = () => [
        { speed: 0, influence: 33.333333 }
    ];
    animated.keyTemporalAutoBezier = animated.keyTemporalContinuous = () =>
        false;
    animated.setValueAtKey =
        animated.setValueAtTime =
        animated.removeKey =
            () => {
                throw Error('Animation mutation forbidden');
            };
    l.parade.effects.push(
        h.effect(l, 'ADBE Glo2', 6, [animated, h.prop('Static', 6)])
    );
    const p = h.start();
    analyzed(h, p);
    h.pick(p, h.results(p).items[0]);
    assert.equal(reads, 0);
    h.dialogHooks['Animation Inspection'] = (d) => {
        const lists = h.all(d, 'listbox');
        lists[0].items[0].selected = true;
        h.click(d, 'Inspect Selected');
        assert.equal(lists[1].items.length, 2);
        assert.equal(lists[1].items[0].subItems[0].text, '0');
        assert.equal(lists[1].items[0].subItems[1].text, '10');
        assert.match(lists[1].items[0].subItems[2].text, /Ease/);
        lists[1].selection = lists[1].items[0];
        lists[1].onChange();
        assert.match(h.all(d, 'edittext')[0].text, /inEase/);
        h.click(d, 'Close');
    };
    h.more(p, 'Inspect Animation...');
    assert.equal(reads, 2);
    assert.equal(h.calls.filter((c) => c[0] === 'set').length, 0);
    assert.equal(h.alerts.length, 0);
});

test('automatic Refresh failure keeps the successful report and never retries itself', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    let starts = 0;
    h.adapter.scanCursor = () => {
        starts++;
        throw Error('Scope unavailable during auto Refresh');
    };
    h.click(p, 'Disable');
    assert.equal(starts, 1);
    assert.equal(p.fxController.batch.lastReport.changed, 1);
    assert.ok(
        h.all(p, 'button').some((b) => b.text === 'Results...' && b.enabled)
    );
    assert.equal(h.tasks.size, 0);
    assert.equal(p.fxController.scanner.basic.stale, true);
});

test('preset library disables applying to a different effect type and corrupt storage cannot block All effects', () => {
    const store = storage(),
        h = ui({ presetStore: store });
    new h.FX.Presets.Library(store).save('Slider', 'ADBE Slider Control', [
        {
            path: [{ matchName: 'Intensity', index: 1 }],
            name: 'Intensity',
            valueType: 'OneD',
            value: 8
        }
    ]);
    h.glow();
    const p = h.start();
    analyzed(h, p);
    h.pick(p, h.results(p).items[0]);
    h.dialogHooks['Effect presets'] = (d) => {
        assert.equal(
            h
                .all(d, 'button')
                .find((b) => b.text === 'Apply to selected effects...').enabled,
            false
        );
        h.click(d, 'Close');
    };
    h.click(p, 'Presets...');
    const bad = ui({
        presetStore: {
            load() {
                throw Error('Corrupt preset library');
            }
        }
    });
    const c = bad.comp();
    c.addLayer();
    const panel = bad.start();
    bad.scan(panel);
    bad.pick(
        panel,
        nodes(bad.results(panel)).find((n) => n.fxLeaf)
    );
    bad.dialogHooks['Choose effect to apply'] = (d) => {
        assert.match(bad.all(d, 'statictext')[0].text, /presets unavailable/);
        bad.all(d, 'listbox')[0].selection = 0;
        bad.click(d, 'Choose');
    };
    bad.click(panel, 'Add Effect...');
    bad.drain(panel);
    assert.equal(c.layers[0].parade.numProperties, 1);
    assert.equal(bad.alerts.length, 0);
});
