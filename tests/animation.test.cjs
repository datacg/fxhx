const test = require('node:test'),
    assert = require('node:assert/strict');
const { fixture, plain } = require('./helpers.cjs');
const KeyframeInterpolationType = { LINEAR: 1, HOLD: 2, BEZIER: 3 };
function setup(
    type = 'OneD',
    mode = 'LINEAR',
    influence = 33.333333,
    speed = 0
) {
    const h = fixture({ KeyframeInterpolationType }),
        c = h.comp(),
        l = c.addLayer(),
        reads = [];
    const p = h.prop('Animated', 0, type, { numKeys: 2 });
    p.keyTime = (k) => {
        reads.push('time');
        return k - 1;
    };
    p.keyValue = (k) => {
        reads.push('keyValue');
        return type === 'OneD' ? k : [k, k];
    };
    p.keyInInterpolationType = p.keyOutInterpolationType = () =>
        KeyframeInterpolationType[mode];
    p.keyInTemporalEase = p.keyOutTemporalEase = () => [{ speed, influence }];
    p.keyTemporalAutoBezier = () => false;
    p.keyTemporalContinuous = () => false;
    p.keyInSpatialTangent = () => [1, 2];
    p.keyOutSpatialTangent = () => [2, 3];
    p.keySpatialAutoBezier = () => false;
    p.keySpatialContinuous = () => true;
    p.keyRoving = () => false;
    const neighbor = h.prop('Neighbor', 9),
        e = h.effect(l, 'ADBE Glo2', 6, [p, neighbor]);
    l.parade.effects.push(e);
    h.scanner.start('entire');
    while (h.scanner.tick()) {}
    const inventory = h.scanner.current(),
        record = inventory.instances[0],
        layer = inventory.layers[0],
        path = [{ matchName: 'Animated', index: 1 }];
    return {
        ...h,
        p,
        e,
        reads,
        record,
        layer,
        path,
        inspect: () => h.adapter.inspectAnimation(record, [path], layer)[0]
    };
}
test('capture classifies Static, Keyframed, Expression-driven, Mixed and Unsupported without reading keyframe details', () => {
    const h = setup(),
        opaque = h.prop('Opaque', 0, 'CUSTOM_VALUE'),
        unknown = h.prop('Unknown', 0, 'OneD', { numKeys: undefined });
    const props = [
        h.prop('Static', 1),
        h.p,
        h.prop('Expr', 0, 'OneD', {
            expression: 'time',
            expressionEnabled: false
        }),
        h.prop('Mixed', 0, 'OneD', { numKeys: 1, expression: 'value' }),
        opaque,
        unknown
    ];
    Object.defineProperty(opaque, 'value', {
        get() {
            throw Error('opaque value read');
        }
    });
    const config = h.adapter.capture(h.effect(h.layer, 'ADBE Glo2', 6, props));
    assert.deepEqual(plain(config.states.map((x) => x.state)), [
        'Static',
        'Keyframed',
        'Expression-driven',
        'Mixed',
        'Unsupported',
        'Unsupported'
    ]);
    assert.equal(config.states[2].expressionEnabled, false);
    assert.equal(h.reads.length, 0);
    assert.match(
        h.FX.Animation.summary(config),
        /Animated.*Expression.*Partial/
    );
    assert.equal(h.FX.Animation.summary(null), 'Animation status not analyzed');
    assert.equal(h.FX.Animation.matches(null, 'Static'), false);
    assert.equal(
        h.FX.Animation.summary({ properties: [], unsupported: [] }),
        'Partial'
    );
});
test('explicit inspection accesses selected existing paths only and cannot mutate the host', () => {
    const h = setup(),
        violations = [];
    function fail(name) {
        violations.push(name);
        throw Error(name);
    }
    h.app.beginUndoGroup = () => fail('undo');
    h.e.remove = () => fail('remove');
    h.p.setValue = () => fail('setValue');
    h.p.setValueAtTime = () => fail('setValueAtTime');
    h.p.removeKey = () => fail('removeKey');
    const layer = h.adapter.resolveLayer(h.record).layer;
    layer.parade.addProperty = () => fail('addProperty');
    Object.defineProperty(h.e, 'enabled', {
        get: () => true,
        set: () => fail('enabled')
    });
    Object.defineProperty(h.e.property(2), 'value', {
        get() {
            throw Error('Neighbor value touched');
        }
    });
    h.p.keyInSpatialTangent = h.p.keyOutSpatialTangent = () =>
        fail('irrelevant spatial API');
    const s = h.inspect();
    assert.equal(s.complete, true);
    assert.equal(s.data.keys.length, 2);
    assert.equal(s.data.keys[0].curve, 'Linear');
    assert.deepEqual(violations, []);
    assert.equal(h.reads.length, 4);
    assert.throws(
        () => h.adapter.inspectAnimation(h.record, [], h.layer),
        /Select/
    );
});
test('Linear, Hold, Bezier/Easy Ease-like and custom easing remain distinct, including equal values/times', () => {
    const linear = setup().inspect(),
        hold = setup('OneD', 'HOLD').inspect(),
        easy = setup('OneD', 'BEZIER').inspect(),
        custom = setup('OneD', 'BEZIER', 70, 4).inspect();
    assert.equal(hold.data.keys[0].curve, 'Hold');
    assert.match(easy.data.keys[0].curve, /Easy Ease-like/);
    assert.match(custom.data.keys[0].curve, /Custom/);
    const h = fixture();
    assert.equal(h.FX.Animation.compare(linear, hold).equal, false);
    assert.equal(
        h.FX.Animation.compare(easy, custom).status,
        'Different Animation Metadata'
    );
    assert.equal(
        h.FX.Animation.compare(easy, JSON.parse(JSON.stringify(easy))).equal,
        true
    );
    assert.deepEqual(
        plain(easy.data.keys.map((x) => [x.time, x.value])),
        plain(custom.data.keys.map((x) => [x.time, x.value]))
    );
});
test('spatial inspection reads tangents/flags/roving only where applicable and includes them in comparisons', () => {
    const h = setup('TwoD_SPATIAL', 'BEZIER'),
        a = h.inspect();
    assert.deepEqual(plain(a.data.keys[0].inSpatialTangent), [1, 2]);
    assert.equal(a.data.keys[0].spatialContinuous, true);
    h.p.keyRoving = () => true;
    const b = h.inspect();
    assert.equal(h.FX.Animation.compare(a, b).equal, false);
    h.p.keyInSpatialTangent = () => {
        throw Error('unsupported');
    };
    const partial = h.inspect();
    assert.equal(partial.complete, false);
    assert.ok(partial.reasons.some((x) => x.includes('keyInSpatialTangent')));
});
test('missing interpolation/ease APIs, expressions and unknown types never produce false exact comparison', () => {
    const h = setup('OneD', 'BEZIER');
    h.p.expression = 'value*2';
    h.p.expressionEnabled = false;
    delete h.p.keyInTemporalEase;
    const a = h.inspect();
    assert.equal(a.data.state, 'Mixed');
    assert.equal(a.data.expressionEnabled, false);
    assert.equal(a.complete, false);
    assert.equal(h.FX.Animation.compare(a, h.inspect()).equal, false);
    assert.match(h.FX.Animation.compare(a, h.inspect()).status, /Partial/);
    h.p.propertyValueType = h.PropertyValueType.CUSTOM_VALUE;
    const unsupported = h.inspect();
    assert.equal(unsupported.data.state, 'Unsupported');
    assert.equal(unsupported.complete, false);
    assert.ok(
        h.adapter.diagnostics.entries.every(
            (x) => !JSON.stringify(x).includes('value*2')
        )
    );
});
test('animation filters retain unknown authorized candidates until explicit classification', () => {
    const h = fixture();
    h.glow();
    h.scan();
    const first = h.scanner.basic.instances[0];
    delete h.scanner.configurations['$' + h.FX.Model.effectKey(first)];
    let captures = 0;
    const capture = h.adapter.capture;
    h.adapter.capture = function (...args) {
        captures++;
        return capture.apply(this, args);
    };
    h.scanner.analyze({ animation: 'Static' });
    while (h.scanner.tick()) {}
    assert.equal(captures, 18);
    assert.equal(h.scanner.result.instances.length, 18);
    assert.equal(h.scanner.inventory().instances.length, 18);
    assert.ok(h.scanner.inventory().instances[0].configuration);
});
test('static batch writing preserves keyframes and expression text, values and interpolation callbacks', () => {
    const h = setup('OneD', 'BEZIER'),
        e = h.e;
    const before = h.inspect();
    h.scan();
    const s = h.scanner.current();
    const row = {
        path: [{ matchName: 'Neighbor', index: 2 }],
        valueType: 'OneD',
        name: 'Neighbor',
        value: 12
    };
    h.batch.execute(h.batch.preview(s.instances, 'set', { rows: [row] }));
    const after = h.inspect();
    assert.deepEqual(plain(before.data), plain(after.data));
    assert.equal(e.property(2).value, 12);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 1);
});
test('unknown key count is never treated as a safe static write', () => {
    const h = setup();
    h.p.numKeys = undefined;
    const report = h.adapter.writeRows(h.e, [
        { path: h.path, valueType: 'OneD', value: 8 }
    ]);
    assert.equal(report.written, 0);
    assert.equal(report.skipped, 1);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
});
test('inspection truncates excessive keyframes with an explicit partial result', () => {
    const h = setup();
    h.p.numKeys = 2001;
    const result = h.inspect();
    assert.equal(result.data.keyCount, 2001);
    assert.equal(result.data.keys.length, 2000);
    assert.equal(result.complete, false);
    assert.ok(result.reasons.some((x) => x.includes('key-limit')));
});
