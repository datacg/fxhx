const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');

function setupEffect(h, comp, matchName = 'BSKL AI Color Match') {
    const layer = comp.addLayer(), reads = [], mutations = [];
    function protectedProperty(id, name, type = 'OneD') {
        const p = h.prop(id, 100, type, { name });
        Object.defineProperty(p, 'value', {
            get() { reads.push(name); throw Error('Protected value must not be read'); }
        });
        p.setValue = () => { mutations.push(name); throw Error('Protected write'); };
        p.removeKey = () => { mutations.push(name); throw Error('Protected key removal'); };
        return p;
    }
    const opacity = protectedProperty('ADBE Effect Mask Opacity', 'Effect Opacity');
    const gpu = protectedProperty('ADBE Force CPU GPU', 'GPU Rendering');
    const system = {
        name: 'Compositing Options', matchName: 'ADBE Effect Built In Params',
        propertyType: 3, numProperties: 2,
        property(index) {
            reads.push('system child');
            return index === 1 ? opacity : gpu;
        }
    };
    const intensity = h.prop('Public Intensity', 50, 'OneD', { name: 'Intensity' });
    const children = [
        protectedProperty('Private Connection', 'Connection Timestamp'),
        protectedProperty('Help', "We're here if you need us :)", 'NO_VALUE'),
        protectedProperty('Reference', 'Color Style Image', 'LAYER_INDEX'),
        protectedProperty('Images', 'Style & Reference Images', 'CUSTOM_VALUE'),
        protectedProperty('Match', 'Match at Playhead', 'NO_VALUE'),
        protectedProperty('LUT', 'Save LUT', 'NO_VALUE'),
        intensity,
        protectedProperty('Private Unknown', 'Private Future Field'),
        system
    ];
    const effect = h.effect(layer, matchName, 0, children);
    effect.name = 'AI Color Match';
    layer.parade.effects.push(effect);
    return { layer, effect, intensity, opacity, gpu, reads, mutations };
}
function row(path, name = 'Intensity', value = 20) {
    return { path, name, value, valueType: 'OneD' };
}

test('AI Color Match captures only public Intensity without reading internal values or the system group', () => {
    const h = fixture(), e = setupEffect(h, h.comp());
    const config = h.adapter.capture(e.effect);
    assert.equal(config.parameterProfile, 'ai-color-match');
    assert.deepEqual(plain(config.properties.map(p => [p.name, p.value])), [['Intensity', 50]]);
    assert.equal(e.reads.length, 0);
    assert.equal(e.mutations.length, 0);
    const editable = h.FX.Presentation.editRows([{ configuration: config }]);
    assert.deepEqual(plain(editable.map(p => p.name)), ['Intensity']);
});

test('the audited Color Match schema is recognized with an opaque matchName and a renamed effect instance', () => {
    const h = fixture(), e = setupEffect(h, h.comp(), 'vendor-opaque-identity-v1');
    e.effect.name = 'Renamed by user';
    const config = h.adapter.capture(e.effect);
    assert.equal(config.parameterProfile, 'ai-color-match');
    assert.equal(config.properties.length, 1);
    assert.equal(config.properties[0].name, 'Intensity');
    assert.equal(e.reads.length, 0);
});

test('renaming another effect to AI Color Match never gives it the Color Match profile', () => {
    const h = fixture(), comp = h.comp(), layer = comp.addLayer();
    const effect = h.effect(layer);
    effect.name = 'AI Color Match';
    const config = h.adapter.capture(effect);
    assert.equal(config.parameterProfile, null);
    assert.deepEqual(plain(config.properties.map(p => p.name)), ['Intensity', 'Radius']);
});

test('generic effects omit localized host compositing fields while keeping their own public opacity and elided children', () => {
    const h = fixture(), comp = h.comp(), layer = comp.addLayer();
    const ownOpacity = h.prop('Public Opacity', 80, 'OneD', { name: 'Opacity' });
    const own = { propertyType: 3, matchName: 'Public Controls', name: 'Controls',
        elided: true, numProperties: 1, property: () => ownOpacity };
    const system = { propertyType: 3, matchName: 'ADBE Effect Built In Params',
        name: 'Opções de composição', numProperties: 1,
        property() { throw Error('System group must not be traversed'); } };
    const config = h.adapter.capture(h.effect(layer, 'ADBE Test Effect', 0, [own, system]));
    assert.equal(config.properties.length, 1);
    assert.equal(config.properties[0].name, 'Opacity');
    assert.equal(config.properties[0].value, 80);
    assert.ok(config.excluded.some(p => p.reason === 'host-system-parameter'));
    assert.equal(h.FX.Config.fingerprint(config).complete, true);
});

test('direct writes and disguised old rows cannot change internal fields or remove their keyframes', () => {
    const h = fixture(), e = setupEffect(h, h.comp());
    const paths = [
        [{ matchName: 'Private Connection', index: 1 }],
        [{ matchName: 'Private Unknown', index: 8 }],
        [{ matchName: 'ADBE Effect Built In Params', index: 9 }, { matchName: 'ADBE Effect Mask Opacity', index: 1 }],
        [{ matchName: 'ADBE Force CPU GPU', index: 1 }]
    ];
    for (const path of paths) {
        const result = h.adapter.writeRows(e.effect, [row(path)]); // forged public label
        assert.equal(result.skipped, 1);
        assert.equal(result.written, 0);
        assert.equal(result.unknown, 0);
        assert.throws(() => h.adapter.validateKeyframeRemoval(e.effect,
            [{ path, valueType: 'OneD', keyCount: 2 }]), /Internal\/system/);
    }
    assert.equal(e.reads.length, 0);
    assert.equal(e.mutations.length, 0);
});

test('explicit path capture does not bypass system or internal exclusions', () => {
    const h = fixture(), e = setupEffect(h, h.comp());
    const config = h.adapter.capture(e.effect, [[{ matchName: 'Private Connection', index: 1 }]]);
    assert.equal(config.properties.length, 0);
    assert.equal(config.excluded[0].reason, 'internal-parameter');
    assert.equal(e.reads.length, 0);
});

test('old snapshots and presets omit known internal fields and a protected-only selection cannot open the editor', () => {
    const h = fixture();
    const properties = [
        row([{ matchName: 'Public Intensity', index: 1 }], 'Intensity', 50),
        row([{ matchName: 'Private Connection', index: 2 }], 'Connection Timestamp', 0),
        row([{ matchName: 'ADBE Effect Mask Opacity', index: 3 }], 'Localized name', 100),
        row([{ matchName: 'ADBE Force CPU GPU', index: 4 }], 'Localized GPU', 1)
    ];
    const config = { effectMatchName: 'BSKL AI Color Match', properties, unsupported: [] };
    assert.deepEqual(plain(h.FX.Presentation.editRows([{ configuration: config }]).map(p => p.name)), ['Intensity']);
    assert.deepEqual(plain(h.FX.Parameters.rows(config.effectMatchName, properties).map(p => p.name)), ['Intensity']);
    config.properties = properties.slice(1);
    const selection = { instances: [{ matchName: config.effectMatchName, configuration: config }], layers: [] };
    assert.equal(h.FX.Presentation.selectionState(selection, true).action, 'none');
});

test('batch preview rejects a protected row before presenting a mutation intent', () => {
    const h = fixture(), comp = h.comp(), e = setupEffect(h, comp);
    const scan = h.scan();
    assert.throws(() => h.batch.preview(scan.instances, 'set', {
        rows: [row([{ matchName: 'ADBE Effect Mask Opacity', index: 1 }])]
    }), /Internal\/system/);
    assert.equal(e.mutations.length, 0);
});

test('adding an effect from a protected-only legacy preset is refused before creating an instance', () => {
    const h = fixture(), comp = h.comp();
    comp.addLayer();
    const scan = h.scan();
    assert.throws(() => h.batch.preview(scan.layers, 'apply', {
        matchName: 'ADBE Glo2', rows: [row([{ matchName: 'ADBE Force CPU GPU', index: 1 }], 'Old label')]
    }), /Internal\/system/);
    assert.equal(comp.layers[0].parade.numProperties, 0);
    assert.equal(h.calls.filter(c => c[0] === 'add').length, 0);
});

test('37 Color Match occurrences offer only Intensity and preserve all excluded data through a batch edit', () => {
    const h = ui(), comp = h.comp(), effects = [];
    for (let i = 0; i < 37; i++) effects.push(setupEffect(h, comp));
    const p = h.start();
    h.scan(p);
    h.click(p, 'Select Results');
    h.read(p);
    h.drain(p);
    h.dialogHooks['Edit Parameters'] = d => {
        const list = h.all(d, 'listbox')[0];
        assert.equal(list.items.length, 1);
        assert.equal(list.items[0].text, 'Intensity');
        assert.equal(list.items[0].subItems[0].text, '50');
        const field = h.parameterFields(d)[0];
        field.text = '35';
        field.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    h.drain(p);
    assert.ok(effects.every(e => e.intensity.value === 35));
    assert.ok(effects.every(e => e.reads.length === 0 && e.mutations.length === 0));
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 37);
    assert.equal(h.alerts.length, 0);
});
