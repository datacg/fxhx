const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');

function keyed(h, name, value, count, options = {}) {
    const p = h.prop(name, value, 'OneD', options);
    p.keys = Array.from({ length: count }, (_, i) => ({ time: i, value }));
    Object.defineProperty(p, 'numKeys', { get: () => p.keys.length });
    p.removeKey = i => { p.keys.splice(i - 1, 1); h.calls.push(['removeKey', name, i]); };
    return p;
}
function example(h, values = [200, 100], counts = [0, 2]) {
    const comp = h.comp(), effects = [], radii = [], modes = [];
    values.forEach((value, i) => {
        const layer = comp.addLayer(undefined, 'Layer ' + (i + 1));
        const radius = keyed(h, 'Radius', value, counts[i]);
        const mode = keyed(h, 'Threshold Mode', 1, i === 1 ? 1 : 0,
            { propertyParameters: ['Chrominance', 'Luminance'] });
        const effect = h.effect(layer, 'Deep Glow 2', 0, [radius, mode, h.prop('Threshold', 80)]);
        layer.parade.effects.push(effect);
        effects.push(effect); radii.push(radius); modes.push(mode);
    });
    return { comp, effects, radii, modes };
}
function ready(options) {
    const h = ui(options), e = example(h), p = h.start();
    h.scan(p); h.click(p, 'Select Results'); h.read(p); h.drain(p);
    return { h, p, ...e };
}
const control = (h, d, type, flag) => h.all(d, type).find(c => c[flag]);
function choose(h, d, name) {
    const list = control(h, d, 'listbox', 'fxParameterList');
    list.selection = list.items.find(i => i.fxEditorRow.name === name); list.onChange();
    return list.selection;
}
function removal(h, d) {
    const box = control(h, d, 'checkbox', 'fxRemoveAnimation');
    box.value = true; box.onClick();
}

test('current values include keyed occurrences and group all equal values by effect count', () => {
    const h = fixture(); example(h, [200, 100, 100], [0, 2, 1]);
    const scan = h.scan(), rows = h.FX.Presentation.editRows(scan.instances);
    const radius = rows.find(r => r.name === 'Radius');
    assert.equal(radius.current, 'Mixed Values');
    assert.deepEqual(plain(radius.valueGroups), [{ value: 200, count: 1 }, { value: 100, count: 2 }]);
    assert.equal(radius.previous, '200 (1); 100 (2)');
    assert.equal(radius.singleKeyEffects, 1);
    assert.equal(radius.keyframes, 3);
    assert.equal(scan.instances[1].configuration.properties.some(p => p.name === 'Radius'), false);
    const mode = rows.find(r => r.name === 'Threshold Mode');
    assert.equal(mode.current, 'Chrominance');
    assert.equal(mode.previous, 'Chrominance (3)');
});

test('Radius 200/100 to 150 requires the whole selection and reviews both previous values', () => {
    const { h, p, radii, modes } = ready();
    h.setKeyframeConsent(true); h.setPartialConsent(false);
    h.dialogHooks['Parameter occurrences'] = d => {
        const table = h.all(d, 'listbox')[0];
        assert.deepEqual(table.items.map(i => i.subItems[3].text), ['200', '100']);
        assert.deepEqual(table.items.map(i => i.subItems[0].text), ['Layer 1', 'Layer 2']);
        h.click(d, 'Close');
    };
    h.dialogHooks['Edit Parameters'] = d => {
        const item = choose(h, d, 'Radius');
        assert.equal(item.subItems[0].text, 'Mixed Values');
        assert.match(control(h, d, 'edittext', 'fxPreviousValues').text, /200 \(1\); 100 \(1\)/);
        h.click(d, 'View targets');
        const field = h.parameterFields(d)[0]; field.text = '150'; field.onChanging();
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, false);
        assert.ok(h.all(d, 'statictext').some(c => /Remove keyframes for this parameter/.test(c.text)));
        removal(h, d);
        assert.equal(item.subItems[2].text, '2/2');
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, true);
        const pending = control(h, d, 'listbox', 'fxPendingChanges').items[0];
        assert.equal(pending.subItems[0].text, '200 (1); 100 (1) -> 150');
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(radii.map(p => p.value), [150, 150]);
    assert.deepEqual(radii.map(p => p.numKeys), [0, 0]);
    assert.equal(modes[1].numKeys, 1);
    assert.match(h.confirmations.at(-1), /Radius: 200 \(1\); 100 \(1\) -> 150/);
    assert.match(h.confirmations.at(-1), /all 2 selected effects/);
    const confirm = h.windows.find(d => d.text === 'Confirm changes');
    assert.equal(h.all(confirm, 'checkbox').some(c => /only compatible/.test(c.text)), false);
    assert.equal(h.alerts.length, 0);
});

test('a single menu keyframe can be cleared with no replacement value and keeps the current choice', () => {
    const { h, p, modes, radii } = ready({ selectionNotifications: 'always' }); h.setKeyframeConsent(true);
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Threshold Mode');
        assert.ok(h.all(d, 'statictext').some(c => /1 with a single keyframe/.test(c.text)));
        assert.equal(control(h, d, 'dropdownlist', 'fxParameterMenu').selection.index, 0);
        removal(h, d);
        const pending = control(h, d, 'listbox', 'fxPendingChanges').items[0];
        assert.match(pending.subItems[0].text, /Chrominance \(2\) -> Keep each current value/);
        assert.equal(pending.subItems[1].text, 'Clear keys; keep each value');
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(modes.map(p => [p.numKeys, p.value]), [[0, 1], [0, 1]]);
    assert.deepEqual(radii.map(p => [p.numKeys, p.value]), [[0, 200], [2, 100]]);
    assert.equal(h.calls.filter(c => c[0] === 'removeKey').length, 1);
    assert.match(h.confirmations.at(-1), /keep each current value/);
    assert.equal(h.alerts.length, 0);
});

test('Radius, single-keyframe Threshold Mode and Threshold apply to every selected effect in one batch', () => {
    const { h, p, radii, modes, effects } = ready(); h.setKeyframeConsent(true); h.setPartialConsent(false);
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Radius');
        const field = h.parameterFields(d)[0]; field.text = '150'; field.onChanging(); removal(h, d);
        choose(h, d, 'Threshold Mode'); removal(h, d);
        const menu = control(h, d, 'dropdownlist', 'fxParameterMenu'); menu.selection = 2; menu.onChange();
        choose(h, d, 'Threshold'); field.text = '65'; field.onChanging();
        const pending = control(h, d, 'listbox', 'fxPendingChanges');
        assert.equal(pending.items.length, 3);
        assert.match(pending.items.find(i => i.text === 'Threshold Mode').subItems[0].text, /Chrominance \(2\) -> Luminance/);
        assert.match(pending.items.find(i => i.text === 'Threshold').subItems[0].text, /80 \(2\) -> 65/);
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(radii.map(p => p.value), [150, 150]);
    assert.deepEqual(modes.map(p => [p.numKeys, p.value]), [[0, 2], [0, 2]]);
    assert.deepEqual(effects.map(e => e.property(3).value), [65, 65]);
    assert.equal(h.calls.filter(c => c[0] === 'begin').length, 1);
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 6);
    assert.equal(h.alerts.length, 0);
});

test('clearing keys with blank input preserves different values on each selected effect', () => {
    const { h, p, radii } = ready(); h.setKeyframeConsent(true);
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Radius'); removal(h, d);
        assert.equal(h.parameterFields(d)[0].text, '');
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.deepEqual(radii.map(p => [p.numKeys, p.value]), [[0, 200], [0, 100]]);
    assert.equal(h.alerts.length, 0);
});

test('clearing a single keyframe still requires final consent and cancellation restores the draft', () => {
    const { h, p, modes } = ready();
    h.dialogHooks['Edit Parameters'] = d => {
        choose(h, d, 'Threshold Mode'); removal(h, d); h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(modes[1].numKeys, 1);
    assert.equal(h.calls.filter(c => c[0] === 'set' || c[0] === 'removeKey').length, 0);
    assert.match(h.confirmations.at(-1), /Remove 1 keyframes in 1 effects/);
    h.setKeyframeConsent(true);
    h.dialogHooks['Edit Parameters'] = d => {
        assert.equal(control(h, d, 'checkbox', 'fxRemoveAnimation').value, true);
        assert.equal(control(h, d, 'dropdownlist', 'fxParameterMenu').selection.index, 0);
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...'); h.drain(p);
    assert.equal(modes[1].numKeys, 0);
    assert.equal(modes[1].value, 1);
    assert.equal(h.alerts.length, 0);
});

test('all-selected batch refuses a keyed target without authorization and refuses locked or missing targets', () => {
    for (const issue of ['keyed', 'locked', 'missing', 'expression']) {
        const h = fixture(), e = example(h);
        if (issue === 'locked') e.comp.layers[1].locked = true;
        if (issue === 'missing') e.radii[1].matchName = 'Other';
        if (issue === 'expression') e.radii[1].expression = 'value';
        const scan = h.scan(), row = plain(scan.instances[0].configuration.properties[0]); row.value = 150;
        assert.throws(() => h.batch.preview(scan.instances, 'set', { rows: [row], requireAll: true }), /Cannot update all selected/);
        assert.equal(h.calls.filter(c => c[0] === 'set' || c[0] === 'removeKey').length, 0);
    }
});

test('a bound failure on any selected target aborts before the first setter or key removal', () => {
    const h = fixture(), e = example(h);
    e.radii[1].hasMax = true; e.radii[1].maxValue = 120;
    const scan = h.scan(), row = plain(scan.instances[0].configuration.properties[0]); row.value = 150;
    const plan = h.batch.preview(scan.instances, 'set', { rows: [row], requireAll: true, removeKeyframes: [row.path] });
    assert.throws(() => h.batch.execute(plan), /above maximum/);
    assert.deepEqual(e.radii.map(p => [p.numKeys, p.value]), [[0, 200], [2, 100]]);
    assert.equal(h.calls.filter(c => c[0] === 'set' || c[0] === 'removeKey').length, 0);
});

test('current value changes after review abort clearing keys on all selected effects', () => {
    const h = fixture(), e = example(h), scan = h.scan();
    const row = plain(scan.instances[0].configuration.properties[0]); row.keepCurrent = true;
    const plan = h.batch.preview(scan.instances, 'set', { rows: [row], requireAll: true, removeKeyframes: [row.path] });
    e.radii[1].value = 75;
    assert.throws(() => h.batch.execute(plan), /Current value changed/);
    assert.equal(e.radii[1].numKeys, 2);
    assert.equal(h.calls.filter(c => c[0] === 'set' || c[0] === 'removeKey').length, 0);
});

test('an unreadable keyed snapshot is explicit and never makes the static value represent the whole selection', () => {
    const h = fixture(), e = example(h);
    Object.defineProperty(e.radii[1], 'value', { get() { throw Error('Snapshot unavailable'); } });
    const scan = h.scan(), radius = h.FX.Presentation.editRows(scan.instances).find(r => r.name === 'Radius');
    assert.equal(radius.current, 'Mixed / unavailable');
    assert.equal(radius.previous, '200 (1); Unavailable (1)');
    const row = plain(scan.instances[0].configuration.properties[0]); row.keepCurrent = true;
    assert.throws(() => h.batch.preview(scan.instances, 'set', { rows: [row], requireAll: true, removeKeyframes: [row.path] }), /Current value unavailable/);
});
