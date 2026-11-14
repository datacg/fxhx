const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');

function keyed(h, name, count, value = 5, type = 'OneD', options = {}) {
    const p = h.prop(name, value, type, options);
    p.keys = Array.from({ length: count }, (_, i) => ({ time: i, value: i + 1, ease: 33 }));
    Object.defineProperty(p, 'numKeys', { configurable: true, get: () => p.keys.length });
    p.removeKey = index => {
        assert.ok(index >= 1 && index <= p.keys.length);
        p.keys.splice(index - 1, 1);
        h.calls.push(['removeKey', name, index]);
    };
    const set = p.setValue;
    p.setValue = value => {
        assert.equal(p.numKeys, 0);
        set.call(p, value);
    };
    return p;
}
function setup() {
    const h = fixture(), c = h.comp(), a = c.addLayer(), b = c.addLayer();
    const first = h.prop('Vibrance', 7), animated = keyed(h, 'Vibrance', 3);
    const neighbor = keyed(h, 'Exposure', 2);
    a.parade.effects.push(h.effect(a, 'ADBE Lumetri', 0, [first]));
    b.parade.effects.push(h.effect(b, 'ADBE Lumetri', 0, [animated, neighbor, h.prop('Static', 11)]));
    const scan = h.scan(), path = [{ matchName: 'Vibrance', index: 1 }];
    const row = { path, name: 'Vibrance', valueType: 'OneD', value: 20 };
    const plan = options => h.batch.preview(scan.instances, 'set', { rows: [row], ...options });
    return { ...h, c, first, animated, neighbor, scan, path, row, plan };
}

test('default static edit preserves keys; explicit conversion removes only the chosen path in descending order', () => {
    const h = setup(), neighbor = plain(h.neighbor.keys);
    const plan = h.plan({ removeKeyframes: [h.path] });
    assert.equal(plan.keyframeCount, 3);
    const result = h.batch.execute(plan);
    assert.equal(h.first.value, 20);
    assert.equal(h.animated.value, 20);
    assert.equal(h.animated.numKeys, 0);
    assert.deepEqual(plain(h.neighbor.keys), neighbor);
    assert.deepEqual(h.calls.filter(c => c[0] === 'removeKey'), [
        ['removeKey', 'Vibrance', 3], ['removeKey', 'Vibrance', 2], ['removeKey', 'Vibrance', 1]
    ]);
    assert.equal(result.keyframesRemoved, 3);
    assert.equal(result.verified, 2);
    assert.equal(result.unknown, 0);
    assert.equal(h.calls.filter(c => c[0] === 'begin').length, 1);
    assert.equal(h.calls.filter(c => c[0] === 'end').length, 1);

    const normal = setup(), before = plain(normal.animated.keys);
    const kept = normal.batch.execute(normal.plan());
    assert.deepEqual(plain(normal.animated.keys), before);
    assert.equal(kept.keyframesRemoved, 0);
    assert.equal(kept.propertiesSkipped, 1);
});

for (const change of ['count', 'expression', 'method']) {
    test('changed animation ' + change + ' aborts all targets before any write or deletion', () => {
        const h = setup(), plan = h.plan({ removeKeyframes: [h.path] });
        if (change === 'count') h.animated.keys.push({ time: 9, value: 9 });
        if (change === 'expression') h.animated.expression = 'value'; // disabled still protected
        if (change === 'method') h.animated.removeKey = undefined;
        assert.throws(() => h.batch.execute(plan), /changed|Expression|unavailable/);
        assert.equal(h.first.value, 7);
        assert.equal(h.calls.filter(c => c[0] === 'set' || c[0] === 'removeKey').length, 0);
        assert.equal(h.batch.lastReport.failedBeforeWrite, 2);
    });
}

test('a fixed value outside bounds fails before removing any keyframes', () => {
    const h = setup();
    h.animated.hasMax = true;
    h.animated.maxValue = 10;
    const result = h.batch.execute(h.plan({ removeKeyframes: [h.path] }));
    assert.equal(h.animated.numKeys, 3);
    assert.equal(result.failedBeforeWrite, 1);
    assert.equal(result.keyframesRemoved, 0);
    assert.equal(result.unknown, 0);
});

test('uncertain key removal stops the target, reports partial changes and never retries the host call', () => {
    const h = setup(), remove = h.animated.removeKey;
    h.animated.removeKey = index => {
        remove(index);
        if (index === 2) throw Error('Host failed after removing key');
    };
    const extra = { path: [{ matchName: 'Static', index: 3 }], name: 'Static', valueType: 'OneD', value: 44 };
    const plan = h.batch.preview([h.scan.instances[1]], 'set', {
        rows: [h.row, extra], removeKeyframes: [h.path]
    });
    const result = h.batch.execute(plan);
    assert.equal(h.animated.numKeys, 1);
    assert.equal(h.animated.value, 5);
    assert.equal(h.neighbor.numKeys, 2);
    assert.equal(h.c.layers[1].parade.property(1).property(3).value, 11);
    assert.equal(result.keyframesRemoved, 1); // only returned calls are counted
    assert.equal(result.unknown, 1);
    assert.equal(result.changed, 1);
    assert.equal(result.propertiesSkipped, 1);
    assert.equal(h.calls.filter(c => c[0] === 'removeKey').length, 2);
    assert.equal(h.calls.filter(c => c[0] === 'end').length, 1);
});

test('removal permission is specific to one parameter even when another animated parameter has a new value', () => {
    const h = setup();
    const other = { path: [{ matchName: 'Exposure', index: 2 }], name: 'Exposure', valueType: 'OneD', value: 44 };
    const result = h.batch.execute(h.batch.preview([h.scan.instances[1]], 'set', {
        rows: [h.row, other], removeKeyframes: [h.path]
    }));
    assert.equal(h.animated.numKeys, 0);
    assert.equal(h.animated.value, 20);
    assert.equal(h.neighbor.numKeys, 2);
    assert.equal(h.neighbor.value, 5);
    assert.equal(result.propertiesSkipped, 1);
    assert.equal(result.keyframesRemoved, 3);
});

test('a key removal that returns without removing the key is detected before assigning the fixed value', () => {
    const h = setup();
    let attempts = 0;
    h.animated.removeKey = () => { attempts++; };
    const result = h.batch.execute(h.plan({ removeKeyframes: [h.path] }));
    assert.equal(attempts, 1);
    assert.equal(h.animated.numKeys, 3);
    assert.equal(h.animated.value, 5);
    assert.equal(result.unknown, 1);
    assert.match(result.issues.at(-1).reason, /could not be verified/);
});

test('failed fixed-value assignment after deleting keys remains an uncertain change', () => {
    const h = setup();
    h.animated.setValue = () => { throw Error('Host setter failed'); };
    const result = h.batch.execute(h.plan({ removeKeyframes: [h.path] }));
    assert.equal(h.animated.numKeys, 0);
    assert.equal(result.keyframesRemoved, 3);
    assert.equal(result.unknown, 1);
    assert.equal(result.changed, 2);
});

test('removal requires an edited parameter, a supported numeric type and an explicit set operation', () => {
    const h = setup(), wrong = [{ matchName: 'Exposure', index: 2 }];
    assert.throws(() => h.plan({ removeKeyframes: [wrong] }), /requires a new fixed value/);
    assert.throws(() => h.plan({ removeKeyframes: [h.path, h.path] }), /Duplicate/);
    assert.throws(() => h.batch.preview(h.scan.instances, 'copy', {
        rows: [h.row], removeKeyframes: [h.path]
    }), /only in the parameter editor/);
    assert.equal(h.FX.Config.removable({ state: 'Keyframed', keyCount: 2,
        expressionPresent: false, valueType: 'custom' }), false);
    assert.equal(h.FX.Config.removable({ state: 'Keyframed', keyCount: 2,
        valueType: 'OneD' }), false); // unknown expression state is never permission
});

function mixedUI() {
    const h = ui(), c = h.comp(), properties = [];
    for (let i = 0; i < 7; i++) {
        const layer = c.addLayer(undefined, 'Layer ' + i, { locked: i === 3 });
        let parameter;
        if (i === 0 || i === 6) parameter = h.prop('Vibrance', 10 + i);
        else if (i === 4) parameter = h.prop('Vibrance', null, 'CUSTOM_VALUE');
        else if (i === 5) parameter = h.prop('Other', 10);
        else parameter = keyed(h, 'Vibrance', i === 1 ? 3 : 2, 5,
            'OneD', { expression: i === 2 ? 'value' : '' });
        properties.push(parameter);
        const effect = h.effect(layer, 'ADBE Lumetri', 0, [parameter, keyed(h, 'Exposure', 2)]);
        effect.name = 'Lumetri Color';
        layer.parade.effects.push(effect);
    }
    const p = h.start();
    h.scan(p);
    h.click(p, 'Select Results');
    h.pick(p, h.results(p).items[6], { ctrlKey: true }); // outside the operation
    h.read(p);
    h.drain(p);
    return { h, c, p, properties };
}

test('editor identifies every occurrence and blocks partial edits even with keyframe consent', () => {
    const { h, c, p, properties } = mixedUI();
    h.dialogHooks['Parameter occurrences'] = detail => {
        const table = h.all(detail, 'listbox')[0];
        assert.equal(table.items.length, 6);
        const statuses = table.items.map(i => i.subItems[2].text);
        assert.match(statuses[0], /Editable \(static\)/);
        assert.match(statuses[1], /Keyframed: 3 keyframes/);
        assert.match(statuses[2], /Expression protected/);
        assert.match(statuses[3], /Locked layer/);
        assert.match(statuses[4], /Blocked: custom/);
        assert.match(statuses[5], /Missing/);
        h.click(detail, 'Close');
    };
    h.dialogHooks['Edit Parameters'] = d => {
        const box = h.all(d, 'checkbox')[0];
        assert.equal(box.value, false);
        h.click(d, 'View targets');
        box.value = true;
        box.onClick();
        const field = h.parameterFields(d)[0];
        field.text = '20';
        field.onChanging();
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, false);
        assert.ok(h.all(d, 'statictext').some(t => /Cannot update all selected effects/.test(t.text)));
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...'); // final removal consent is absent
    assert.equal(properties[0].value, 10);
    assert.equal(properties[1].numKeys, 3);
    assert.equal(h.calls.filter(c => c[0] === 'removeKey' || c[0] === 'set').length, 0);
    assert.equal(h.confirmations.length, 0);

    h.setKeyframeConsent(true);
    h.dialogHooks['Edit Parameters'] = d => { // recover the explicit per-parameter draft
        assert.equal(h.all(d, 'checkbox')[0].value, true);
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    h.drain(p);
    assert.equal(h.calls.filter(c => c[0] === 'removeKey' || c[0] === 'set').length, 0);
    assert.equal(properties[0].value, 10);
    assert.equal(properties[1].value, 5);
    assert.equal(properties[1].numKeys, 3);
    assert.equal(properties[2].expression, 'value');
    assert.equal(properties[2].numKeys, 2);
    assert.equal(properties[3].numKeys, 2);
    assert.equal(properties[5].value, 10);
    assert.equal(properties[6].value, 16);
    assert.ok(c.layers.every(l => l.parade.property(1).property(2).numKeys === 2));
    assert.equal(h.alerts.length, 0);
});

test('unchecking removal on an animated-only row clears its destructive draft', () => {
    const h = ui(), c = h.comp(), layer = c.addLayer();
    const parameter = keyed(h, 'Vibrance', 2);
    layer.parade.effects.push(h.effect(layer, 'ADBE Lumetri', 0, [parameter]));
    const p = h.start();
    h.scan(p);
    h.click(p, 'Select Results');
    h.read(p);
    h.drain(p);
    h.dialogHooks['Edit Parameters'] = d => {
        const box = h.all(d, 'checkbox')[0], field = h.parameterFields(d)[0];
        assert.equal(field.enabled, false);
        box.value = true;
        box.onClick();
        assert.equal(field.enabled, true);
        field.text = '20';
        field.onChanging();
        assert.equal(h.all(d, 'listbox')[1].items.length, 1);
        box.value = false;
        box.onClick();
        assert.equal(h.all(d, 'listbox')[1].items.length, 0);
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(parameter.numKeys, 2);
});
