// Regression tests for the 0.1.16 review: input parsing, readback tolerance,
// safe default buttons, color/vector input and multi-parameter preset edits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fixture, config, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');

function flagged(h, d, type, flag) { return h.all(d, type).find(c => c[flag]); }
function choose(h, d, name) {
    const list = flagged(h, d, 'listbox', 'fxParameterList');
    list.selection = list.items.find(item => item.fxEditorRow.name === name); list.onChange();
}

test('numbers accept decimal commas and reject ambiguous text with a readable message', () => {
    const { FX } = load();
    assert.equal(FX.U.parseNumber('20,5'), 20.5);
    assert.equal(FX.U.parseNumber(' -0.25 '), -0.25);
    assert.equal(FX.U.parseNumber('.5'), 0.5);
    assert.equal(FX.U.parseNumber('+3'), 3);
    for (const bad of ['', ' ', 'abc', '0x10', '1e3', '1.000,5', '1,000.5', '2,', 'Infinity', 'NaN']) {
        assert.throws(() => FX.U.parseNumber(bad, 'Radius'), /Radius: enter a number/, bad);
    }
});

test('readback tolerance accepts float storage noise but not rounding or shape changes', () => {
    const { FX } = load();
    assert.ok(FX.U.sameValue(0.2, Math.fround(0.2)));
    assert.ok(FX.U.sameValue([0.1, 0.2, 0.3, 1], [0.1, 0.2, 0.3, 1].map(Math.fround)));
    assert.ok(!FX.U.sameValue(70.4, 70));
    assert.ok(!FX.U.sameValue([1, 2], [1, 2, 3]));
    assert.ok(!FX.U.sameValue(1, [1]));
    assert.ok(FX.U.sameValue(1e6, 1e6 + 1));
    assert.ok(!FX.U.sameValue(1e6, 1e6 + 100));
});

test('a host that stores float32 values is verified, with the stored precision noted', () => {
    const h = fixture(), l = h.comp().addLayer(), e = l.parade.addProperty('ADBE Glo2');
    const p = e.property(1), row = config(0.2).properties[0];
    let value = 1;
    Object.defineProperty(p, 'value', { get() { return value; } });
    p.setValue = v => { value = Math.fround(v); };
    const r = h.adapter.writeRows(e, [row]);
    assert.equal(r.outcomes[0].status, 'Written and Verified');
    assert.equal(r.verified, 1);
    assert.equal(r.verificationFailed, 0);
    assert.match(r.outcomes[0].reason, /own precision/);
});

test('editor accepts a decimal comma and labels the Apply button with the pending count', () => {
    const h = ui(), c = h.comp(), l = c.addLayer();
    const props = [h.prop('Exposure', 5), h.prop('Radius', 80)];
    l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, props));
    const p = h.start(); h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    h.dialogHooks['Edit Parameters'] = d => {
        const apply = h.all(d, 'button').find(b => b.fxTitle === 'Apply');
        assert.equal(apply.text, 'Apply');
        choose(h, d, 'Exposure');
        const field = h.parameterFields(d)[0];
        field.text = '20,5'; field.onChanging();
        assert.equal(apply.text, 'Apply 1 change');
        choose(h, d, 'Radius');
        h.parameterFields(d)[0].text = '90'; h.parameterFields(d)[0].onChanging();
        assert.equal(apply.text, 'Apply 2 changes');
        assert.equal(apply.enabled, true);
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(props.map(x => x.value), [20.5, 90]);
});

test('typing in the editor does not rebuild the pending list on every keystroke', () => {
    const h = ui(), c = h.comp(), l = c.addLayer();
    l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, [h.prop('Exposure', 5), h.prop('Radius', 80)]));
    const p = h.start(); h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Exposure');
        const field = h.parameterFields(d)[0], pending = flagged(h, d, 'listbox', 'fxPendingChanges');
        field.text = '1'; field.onChanging();
        const first = pending.items[0];
        field.text = '12'; field.onChanging();
        field.text = '123'; field.onChanging();
        assert.equal(pending.items[0], first, 'same ListBox item is updated in place');
        assert.match(first.subItems[0].text, /-> 123$/);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
});

test('vector and color inputs show component labels and a hex color fills R, G and B', () => {
    const h = ui(), c = h.comp(), l = c.addLayer();
    const props = [h.prop('Point', [1, 2], 'TwoD'), h.prop('Tint', [1, 1, 1, 1], 'COLOR')];
    l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, props));
    const p = h.start(); h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    h.dialogHooks['Edit Parameters'] = d => {
        const fields = h.parameterFields(d), hex = flagged(h, d, 'edittext', 'fxHexInput');
        choose(h, d, 'Point');
        const labels = fields.map(f => f.parent.children[f.parent.children.indexOf(f) - 1]);
        assert.deepEqual(labels.slice(0, 2).map(x => x.text), ['X', 'Y']);
        assert.equal(hex.visible, false);
        choose(h, d, 'Tint');
        assert.deepEqual(labels.map(x => x.text), ['R', 'G', 'B', 'A']);
        assert.equal(hex.visible, true);
        hex.text = '#FF8000'; hex.onChange();
        assert.deepEqual(fields.map(f => f.text), ['1', '0.502', '0', '1']);
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(plain(props[1].value), [1, 0.502, 0, 1]);
});

test('confirmation shows a change table, names the target count and defaults to Cancel', () => {
    const h = ui(), c = h.comp(), l = c.addLayer();
    l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, [h.prop('Exposure', 5)]));
    const p = h.start(); h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    let confirm = null;
    const original = h.Panel;
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Exposure');
        h.parameterFields(d)[0].text = '7'; h.parameterFields(d)[0].onChanging();
        h.click(d, 'Apply');
    };
    h.setConfirm(false);
    const windows = h.windows.length;
    h.click(p, 'Edit Parameters...'); h.drain(p);
    confirm = h.windows.slice(windows).find(w => w.text === 'Confirm changes');
    assert.ok(confirm && original);
    const table = confirm.children.find(x => x.fxChangeTable);
    assert.equal(table.items[0].text, 'Exposure');
    assert.equal(table.items[0].subItems[1].text, '7');
    const apply = h.all(confirm, 'button').find(b => b.fxTitle === 'Apply');
    assert.equal(apply.text, 'Apply to 1 effect');
    assert.equal(confirm.defaultElement.text, 'Cancel');
    assert.equal(h.calls.filter(x => x[0] === 'set').length, 0);
});

test('preset editor edits several parameters as numbers and saves them together', () => {
    let doc = { schemaVersion: 1, product: 'FX Exchanger Presets', presets: [] };
    const store = { load: () => plain(doc), save: v => { doc = plain(v); } };
    const h = ui({ presetStore: store }), c = h.comp(), l = c.addLayer();
    l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, [h.prop('Exposure', 5), h.prop('Radius', 80)]));
    const e = l.parade.property(1);
    new h.FX.Presets.Library(store).save('Two', 'ADBE Glo2', h.adapter.capture(e).properties, 0);
    const p = h.start(); let opened = 0;
    h.dialogHooks['Effect presets'] = d => { if (opened++ === 0) h.click(d, 'Edit values...'); else h.click(d, 'Close'); };
    h.dialogHooks['Edit preset'] = d => {
        const list = h.all(d, 'listbox')[0], number = h.all(d, 'edittext')[0];
        assert.equal(number.text, '5');
        number.text = '7,5'; number.onChanging();
        list.selection = 1; list.onChange();
        assert.equal(list.items[0].text, 'Exposure = 7.5');
        assert.equal(number.text, '80');
        number.text = 'oops'; number.onChanging();
        list.selection = 0; list.onChange();
        assert.equal(list.selection.index, 1, 'invalid value keeps the parameter selected');
        assert.ok(h.all(d, 'statictext').some(t => /Radius: .*enter a number/.test(t.text)));
        number.text = '81';
        h.click(d, 'Save preset');
    };
    h.click(p, 'Presets...');
    assert.deepEqual(doc.presets[0].rows.map(r => r.value), [7.5, 81]);
    assert.equal(h.calls.filter(x => x[0] === 'set').length, 0);
});

test('update checks explain when AE blocks network access instead of running PowerShell', () => {
    const h = fixture();
    let ran = 0;
    h.adapter.networkAllowed = () => false;
    const previous = h.FX.Updates.checkCommand;
    h.FX.Updates.checkCommand = () => { ran++; return previous(); };
    assert.throws(() => h.adapter.checkForUpdates('0.1.16'), /Allow Scripts to Write Files and Access Network|unavailable/);
    assert.equal(ran, 0);
});

test('Cancel replaces Refresh while work runs, and a progress bar tracks the scan', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    const btn = t => h.all(p, 'button').find(b => b.fxTitle === t);
    const bar = h.all(p, 'progressbar')[0];
    assert.equal(btn('Scan').visible, true);
    assert.equal(btn('Cancel').visible, false);
    assert.equal(bar.visible, false);
    const scanner = p.fxController.scanner, original = scanner.onProgress, seen = [];
    scanner.onProgress = function () {
        original.apply(this, arguments);
        seen.push({ visible: bar.visible, value: bar.value, max: bar.maxvalue });
    };
    p.fxController.scan();
    assert.equal(btn('Cancel').visible, true);
    assert.equal(btn('Scan').visible, false);
    h.drain(p);
    assert.ok(seen.length > 0);
    assert.ok(seen.every(s => s.visible && s.value >= 1 && s.value <= s.max));
    assert.equal(btn('Cancel').visible, false);
    assert.equal(btn('Scan').visible, true);
    assert.equal(btn('Scan').text, 'Refresh');
    assert.equal(bar.visible, false);
});

test('More lists only actions without a panel button, with consistent names', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    let titles = [];
    h.dialogHooks['More Actions'] = d => { titles = h.all(d, 'button').map(b => b.text); h.click(d, 'Cancel'); };
    h.click(p, 'More...');
    for (const duplicate of ['Enable', 'Disable', 'Add Effect...', 'Apply Effect...', 'Issues...', 'Copy Settings From...']) {
        assert.ok(!titles.includes(duplicate), duplicate);
    }
    assert.ok(titles.includes('Remove Effects'));
});

test('the primary button keeps a stable verb and the status explains what to select', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const primary = h.all(p, 'button').find(b => b.fxTitle === 'Scan' && b.text === 'Edit Parameters...');
    assert.ok(primary, 'primary shows Edit Parameters...');
    assert.equal(primary.enabled, false);
    assert.ok(!h.all(p, 'button').some(b => b.text === 'Select an effect'));
});

test('activity phases validate transitions and never leave the panel stuck', () => {
    const { FX } = load();
    const seen = [], a = new FX.Activity((from, to) => seen.push(from + '>' + to));
    assert.equal(a.busy(), false);
    a.enter('listing'); assert.ok(a.busy()); assert.ok(a.cancellable());
    a.enter('reading'); a.enter('idle');
    a.enter('applying'); assert.equal(a.cancellable(), false);
    a.enter('listing'); a.enter('idle');
    assert.equal(a.violations, 0);
    a.enter('applying'); a.enter('reading');
    assert.equal(a.violations, 1);
    assert.deepEqual(seen, ['applying>reading']);
    assert.equal(a.phase, 'reading', 'unexpected transitions are still applied');
    assert.throws(() => a.enter('busy'), /Unknown activity phase/);
});

test('a full list, read, edit, apply and refresh cycle follows only expected phases', () => {
    const h = ui(), c = h.comp(), l = c.addLayer();
    l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, [h.prop('Exposure', 5)]));
    const p = h.start(), activity = p.fxController.activity, phases = [];
    const enter = activity.enter;
    activity.enter = function (phase) { phases.push(phase); return enter.call(this, phase); };
    h.scan(p); h.click(p, 'Select Results');
    h.dialogHooks['Edit Parameters'] = d => {
        const list = h.all(d, 'listbox').find(x => x.fxParameterList);
        list.selection = list.items[0]; list.onChange();
        h.parameterFields(d)[0].text = '9'; h.parameterFields(d)[0].onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.equal(activity.violations, 0, phases.join(' '));
    assert.equal(activity.phase, 'idle');
    assert.ok(phases.includes('listing') && phases.includes('reading') && phases.includes('applying'), phases.join(' '));
});

test('confirmation description is pure data: titles, per-parameter rows and target counts', () => {
    const { FX } = load();
    const plan = { layerCount: 2, compCount: 1, keyframeRemovals: {} };
    const enable = FX.Confirmation.describe([{}, {}], 'enable', {}, plan);
    assert.equal(enable.title, 'Enable effects');
    assert.equal(enable.changeRows.length, 0);
    assert.match(enable.description, /Affected: 2 effects \/ 2 layers \/ 1 compositions/);
    const remove = FX.Confirmation.describe([{}], 'remove', {}, plan);
    assert.match(remove.description, /including keyframes and expressions/);
    const add = FX.Confirmation.describe([{}], 'apply', { displayName: 'Glow', rows: [{}], presetName: 'Soft' }, plan);
    assert.equal(add.partial, true);
    assert.match(add.description, /Preset: Soft\. Adds a NEW instance/);
});

test('Portuguese interface translates static labels while logic keeps English keys', () => {
    const h = ui({ grouped: true }), c = h.glow();
    c.layers[0].parade.property(1).property(1).numKeys = 2;
    h.FX.I18N.use('pt');
    const p = h.start();
    const labels = h.all(p, 'button').map(b => b.text);
    for (const pt of ['Ajuda', 'Filtros...', 'Buscar', 'Presets...', 'Mais...', 'Ativar', 'Desativar']) {
        assert.ok(labels.includes(pt), pt);
    }
    assert.equal(h.all(p, 'button').find(b => b.text === 'Ajuda').fxTitle, 'Help');
    assert.deepEqual(h.all(p, 'dropdownlist')[1].items.map(i => i.text), ['Efeitos', 'Grupos', 'Layers']);
    h.scan(p);
    // Filters compare English keys even though the items show Portuguese.
    h.dialogHooks['Filtros de layer e efeito'] = d => {
        const animation = h.all(d, 'dropdownlist').find(x => x.items.some(i => i.fxKey === 'Animated'));
        assert.ok(animation.items.some(i => i.text === 'Animado'));
        animation.selection = 2;
        h.click(d, 'Use filters');
    };
    h.click(p, 'Filters...');
    assert.match(h.results(p).items[0].text, /18 effects/);
    h.pick(p, h.results(p).items[0]);
    // Dialog titles are translated too, so hooks use the Portuguese title.
    h.dialogHooks['Mais ações'] = d => h.click(d, 'Read Parameters');
    h.click(p, 'More...');
    h.drain(p);
    assert.equal(p.fxController.scanner.result.instances.length, 1);
    assert.equal(h.FX.I18N.applyChanges(2), 'Aplicar 2 alterações');
    assert.equal(h.FX.I18N.applyTo(false, 1), 'Aplicar a 1 efeito');
    assert.equal(h.alerts.length, 0);
});

test('every Portuguese translation key is an English label that exists in the UI sources', () => {
    const { FX } = load();
    const fs = require('node:fs'), path = require('node:path');
    const sources = ['panel.js', 'editor.js', 'help.js', 'valueinput.js', 'i18n.js']
        .map(f => fs.readFileSync(path.join(__dirname, '../src/ui', f), 'utf8')).join('\n');
    for (const key of Object.keys(FX.I18N.dictionary())) {
        assert.ok(sources.includes("'" + key + "'"), key);
    }
    FX.I18N.use('en');
    assert.equal(FX.I18N.t('Help'), 'Help');
});

test('production scan slices are larger than the 0.1.15 12 ms / 30 steps', () => {
    const { FX } = load();
    assert.equal(FX.Scanner.SLICE_MS, 40);
    assert.equal(FX.Scanner.SLICE_STEPS, 150);
});

test('Disable updates the list without relisting the scope or reading parameters', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const basic = p.fxController.scanner.basic;
    h.pick(p, h.results(p).items[0]);
    let cursors = 0, captures = 0;
    const scanCursor = h.adapter.scanCursor, capture = h.adapter.capture;
    h.adapter.scanCursor = function (...a) { cursors++; return scanCursor.apply(this, a); };
    h.adapter.capture = function (...a) { captures++; return capture.apply(this, a); };
    h.click(p, 'Disable');
    h.drain(p);
    assert.equal(cursors, 0, 'no relisting');
    assert.equal(captures, 0, 'no parameter reads');
    assert.equal(p.fxController.scanner.basic, basic);
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(p.fxController.selected().instances[0].enabled, false);
    assert.equal(p.fxController.activity.phase, 'idle');
});

test('a changed effect stack after the write falls back to relisting the scope', () => {
    const h = ui(), c = h.glow();
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    let cursors = 0;
    const scanCursor = h.adapter.scanCursor;
    h.adapter.scanCursor = function (...a) { cursors++; return scanCursor.apply(this, a); };
    // Simulate a setter that adds an effect to the same layer.
    const execute = p.fxController.batch.execute;
    p.fxController.batch.execute = function (plan) {
        const r = execute.call(this, plan);
        c.layers[0].parade.addProperty('ADBE Glo2');
        return r;
    };
    h.click(p, 'Disable');
    h.drain(p);
    assert.equal(cursors, 1, 'full Basic scan after the refused reuse');
    assert.equal(p.fxController.scanner.basic.stale, false);
});

test('on/off detection needs 0/1 values, no units and a 0..1 range (or none)', () => {
    const { FX } = load();
    const row = (control) => ({ valueType: 'OneD', control });
    assert.equal(FX.Parameters.isToggle(row(null), [0, 1]), true);
    assert.equal(FX.Parameters.isToggle(row({ kind: 'number', min: 0, max: 1 }), [1]), true);
    assert.equal(FX.Parameters.isToggle(row({ kind: 'number', min: 0, max: 100 }), [0]), false, 'slider at 0');
    assert.equal(FX.Parameters.isToggle(row({ kind: 'number', units: 'degrees' }), [0]), false, 'angle at 0');
    assert.equal(FX.Parameters.isToggle(row(null), [0, 0.5]), false);
    assert.equal(FX.Parameters.isToggle(row(null), []), false);
    assert.equal(FX.Parameters.isToggle(row({ kind: 'menu', choices: [] }), [1]), false);
    assert.equal(FX.Parameters.isToggle({ valueType: 'TwoD' }, [[0, 1]]), false);
    assert.equal(FX.Parameters.isToggle(row({ kind: 'number', min: 0, max: 100 }), [3], 'ADBE Checkbox Control'), false);
    assert.equal(FX.Parameters.isToggle(row(null), [7], 'ADBE Checkbox Control'), true);
    assert.equal(FX.Parameters.display({ toggle: true }, 1), 'On');
    assert.equal(FX.Parameters.display({ toggle: true }, 0), 'Off');
    assert.equal(FX.Parameters.display({}, 1), '1');
});

function toggleFixture() {
    const h = ui(), c = h.comp();
    const props = [];
    for (const v of [0, 0]) {
        const l = c.addLayer();
        const ps = [h.prop('Repeat Edge Pixels', v), h.prop('Radius', 50)];
        l.parade.effects.push(h.effect(l, 'ADBE Glo2', 0, ps));
        props.push(ps);
    }
    const p = h.start(); h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    return { h, p, props };
}

test('an on/off parameter is edited with a checkbox and written as 1 for every selected effect', () => {
    const { h, p, props } = toggleFixture();
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Repeat Edge Pixels');
        const box = h.all(d, 'checkbox').find(x => x.fxToggleInput);
        assert.equal(box.visible, true);
        assert.equal(box.parent.visible, true);
        assert.equal(box.value, false, 'shows the shared current value (Off)');
        assert.equal(h.parameterFields(d)[0].parent.visible, false, 'number fields hidden');
        assert.ok(h.all(d, 'statictext').some(t => t.text === 'Unchanged (now Off)'));
        const list = flagged(h, d, 'listbox', 'fxParameterList');
        assert.equal(list.items.find(i => i.fxEditorRow.name === 'Repeat Edge Pixels').subItems[0].text, 'Off');
        box.value = true; box.onClick();
        assert.ok(h.all(d, 'statictext').some(t => t.text === 'Will set: On'));
        const pending = flagged(h, d, 'listbox', 'fxPendingChanges');
        assert.match(pending.items[0].subItems[0].text, /Off \(2\) -> On/);
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(props.map(ps => ps[0].value), [1, 1]);
    assert.deepEqual(props.map(ps => ps[1].value), [50, 50], 'other parameters unchanged');
    assert.match(h.confirmations.at(-1), /Repeat Edge Pixels: Off \(2\) -> On/);
});

test('Number... switches a detected on/off parameter back to a numeric field', () => {
    const { h, p, props } = toggleFixture();
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Repeat Edge Pixels');
        h.click(d, 'Number...');
        const box = h.all(d, 'checkbox').find(x => x.fxToggleInput);
        assert.equal(box.parent.visible, false);
        const field = h.parameterFields(d)[0];
        assert.equal(field.parent.visible, true);
        field.text = '0,5'; field.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(props.map(ps => ps[0].value), [0.5, 0.5]);
});

test('Clear this change on a checkbox keeps each original value', () => {
    const { h, p } = toggleFixture();
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Repeat Edge Pixels');
        const box = h.all(d, 'checkbox').find(x => x.fxToggleInput);
        box.value = true; box.onClick();
        assert.equal(flagged(h, d, 'listbox', 'fxPendingChanges').items.length, 1);
        h.click(d, 'Clear this change');
        assert.equal(flagged(h, d, 'listbox', 'fxPendingChanges').items.length, 0);
        assert.equal(box.value, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 0);
});

test('Checkbox returns from Number... to the on/off checkbox, keeping a 0/1 draft', () => {
    const { h, p, props } = toggleFixture();
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Repeat Edge Pixels');
        const box = h.all(d, 'checkbox').find(x => x.fxToggleInput);
        const back = h.all(d, 'button').find(b => b.fxTitle === 'Checkbox');
        assert.equal(back.visible, false, 'hidden while the checkbox is shown');
        box.value = true; box.onClick();
        h.click(d, 'Number...');
        assert.equal(box.parent.visible, false);
        assert.equal(back.visible, true);
        assert.equal(h.parameterFields(d)[0].text, '1');
        h.click(d, 'Checkbox');
        assert.equal(box.parent.visible, true);
        assert.equal(back.visible, false);
        assert.equal(box.value, true);
        assert.ok(h.all(d, 'statictext').some(t => t.text === 'Will set: On'));
        // A non 0/1 number cannot be shown by the checkbox and is dropped.
        h.click(d, 'Number...');
        const field = h.parameterFields(d)[0];
        field.text = '0,5'; field.onChanging();
        h.click(d, 'Checkbox');
        assert.equal(flagged(h, d, 'listbox', 'fxPendingChanges').items.length, 0);
        assert.ok(h.all(d, 'statictext').some(t => t.text === 'Unchanged (now Off)'));
        box.value = true; box.onClick();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(props.map(ps => ps[0].value), [1, 1]);
});

test('the Checkbox button never appears for ordinary numeric parameters', () => {
    const { h, p } = toggleFixture();
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Radius');
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Checkbox').visible, false);
        assert.equal(h.all(d, 'checkbox').find(x => x.fxToggleInput).parent.visible, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
});
