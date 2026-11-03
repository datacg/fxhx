const test = require('node:test'),
    assert = require('node:assert/strict');
const { load, plain, config, fixture } = require('./helpers.cjs');
test('strict JSON preserves unicode, numbers and deterministic key order without evaluating input', () => {
    const { FX } = load();
    const v = {
        z: 'Olá\nGlow \\" \u2028',
        b: [true, null, -0, 1.3e-8],
        a: { x: 2 }
    };
    assert.deepEqual(
        plain(FX.JSON.parse(FX.JSON.stringify(v))),
        JSON.parse(JSON.stringify(v))
    );
    assert.equal(
        FX.JSON.stringify({ b: 1, a: 2 }),
        FX.JSON.stringify({ a: 2, b: 1 })
    );
    for (const s of [
        '(function(){})()',
        '{"__proto__":{}}',
        '{"constructor":1}',
        '{"a":1,"a":2}',
        '[1,]',
        '01',
        '1e999',
        '{"a":undefined}',
        '"\n"',
        'true trailing'
    ])
        assert.throws(() => FX.JSON.parse(s), s);
});
test('full comparison ignores localized names but preserves exact numbers, paths, vector types and enabled', () => {
    const { FX } = load(),
        a = config(),
        b = config();
    b.properties.reverse();
    b.properties[0].name = 'Raio';
    assert.ok(
        FX.Config.equal(FX.Config.fingerprint(a), FX.Config.fingerprint(b))
    );
    b.properties[1].value = 6.000000000001;
    assert.ok(
        !FX.Config.equal(FX.Config.fingerprint(a), FX.Config.fingerprint(b))
    );
    b.properties[1].value = 6;
    b.enabled = false;
    assert.ok(
        !FX.Config.equal(FX.Config.fingerprint(a), FX.Config.fingerprint(b))
    );
});
test('selected parameter projection ignores other parameters but requires all selected paths', () => {
    const { FX } = load(),
        a = config(),
        b = config();
    b.properties[1].value = 100;
    b.enabled = false;
    const paths = [a.properties[0].path];
    assert.ok(
        FX.Config.equal(
            FX.Config.fingerprint(a, paths),
            FX.Config.fingerprint(b, paths)
        )
    );
    b.properties.shift();
    assert.equal(FX.Config.fingerprint(b, paths).complete, false);
});
test('canonical data defeats hash collisions; partial configurations never claim full equivalence', () => {
    const h = fixture();
    h.glow();
    let s = h.scan();
    h.FX.U.hash = () => 'collision';
    assert.equal(h.FX.Grouping.build(s.instances, 'type-config').length, 3);
    const c = config(6, [
        { path: [{ index: 3, matchName: 'Opaque' }], reason: 'custom' }
    ]);
    s.instances[0].configuration = c;
    s.instances[1].configuration = c;
    const partial = h.FX.Grouping.build(s.instances.slice(0, 2), 'config');
    assert.equal(partial.length, 1);
    assert.equal(partial[0].matchStatus, 'Matching Readable Settings');
    assert.equal(partial[0].complete, false);
    assert.equal(
        h.FX.Config.equal(
            h.FX.Config.fingerprint(c),
            h.FX.Config.fingerprint(c)
        ),
        false
    );
});
test('configuration diff exposes only divergent parameters and marks missing/incompatible rows', () => {
    const { FX } = load(),
        a = config(),
        b = config(7);
    let diff = FX.Config.diff(a, b, false);
    assert.equal(diff.length, 1);
    assert.equal(diff[0].name, 'Intensity');
    assert.equal(diff[0].comparable, true);
    b.properties.shift();
    diff = FX.Config.diff(a, b, false);
    assert.equal(diff[0].b, null);
    assert.equal(diff[0].comparable, false);
    assert.equal(FX.Config.diff(a, b, true).length, 2);
});
test('18 Glow acceptance using actual services with mocked AE: 7→6, 15→4, text and radius unchanged', () => {
    const h = fixture();
    h.glow();
    let s = h.scan();
    let g = h.FX.Grouping.build(s.instances, 'type-config');
    assert.deepEqual(
        plain(g.map((x) => x.instances.length).sort((a, b) => a - b)),
        [3, 3, 12]
    );
    let target = s.instances.filter(
        (x) =>
            x.layerType === 'Adjustment' &&
            x.configuration.properties[0].value === 7
    );
    let report = h.batch.execute(
        h.batch.preview(target, 'set', { rows: [config(6).properties[0]] })
    );
    assert.equal(report.changed, 3);
    assert.equal(report.written, 3);
    assert.equal(h.scanner.result.stale, true);
    s = h.scan();
    g = h.FX.Grouping.build(s.instances, 'type-config');
    assert.deepEqual(
        plain(g.map((x) => x.instances.length).sort((a, b) => a - b)),
        [3, 15]
    );
    target = s.instances.filter((x) => x.layerType === 'Adjustment');
    report = h.batch.execute(
        h.batch.preview(target, 'set', { rows: [config(4).properties[0]] })
    );
    assert.equal(report.changed, 15);
    s = h.scan();
    for (const x of s.instances) {
        assert.equal(
            x.configuration.properties[0].value,
            x.layerType === 'Text' ? 50 : 4
        );
        assert.equal(x.configuration.properties[1].value, 80);
    }
    assert.equal(h.calls.filter((x) => x[0] === 'begin').length, 2);
    assert.equal(h.calls.filter((x) => x[0] === 'end').length, 2);
});
test('AND filters locate layers without effects, label indices and partial case-insensitive names', () => {
    const h = fixture(),
        c = h.glow();
    c.addLayer(h.AVLayer, 'Empty Color', { label: 3 });
    const s = h.scan();
    assert.equal(
        h.FX.Filters.apply(s, { effectMode: 'none', name: 'EMPTY', label: 3 })
            .layers.length,
        1
    );
    assert.equal(
        h.FX.Filters.apply(s, {
            type: 'Adjustment',
            label: 5,
            name: 'color',
            effect: 'GLO'
        }).instances.length,
        15
    );
    assert.equal(
        h.FX.Filters.apply(s, {
            type: 'Text',
            label: 5,
            property: config(50).properties[0]
        }).instances.length,
        3
    );
    assert.equal(h.FX.Filters.apply(s, { label: 7 }).layers.length, 0);
});
test('all grouping modes and minority marker respect layer types', () => {
    const h = fixture();
    h.glow();
    const s = h.scan();
    assert.equal(h.FX.Grouping.build(s.instances, 'effect').length, 1);
    assert.equal(h.FX.Grouping.build(s.instances, 'type').length, 2);
    assert.equal(h.FX.Grouping.build(s.instances, 'config').length, 3);
    assert.equal(h.FX.Grouping.build(s.instances, 'composition').length, 3);
    const g = h.FX.Grouping.build(s.instances, 'selected', [
        config().properties[0].path
    ]);
    assert.equal(g.length, 3);
    assert.equal(g.find((x) => x.layerType === 'Text').minority, false);
    assert.equal(
        g.find((x) => x.instances[0].configuration.properties[0].value === 7)
            .minority,
        true
    );
    assert.throws(
        () => h.FX.Grouping.build(s.instances, 'selected', []),
        /Choose/
    );
});
test('value validation rejects wrong dimensions, nonfinite and duplicate paths', () => {
    const { FX } = load();
    assert.throws(() => FX.Validate.value('COLOR', [1, 2, 3]), /dimension/);
    assert.throws(() => FX.Validate.value('OneD', Infinity), /Finite/);
    assert.throws(() => FX.Validate.value('reference', 1), /type/);
    assert.throws(
        () =>
            FX.Validate.rows([config().properties[0], config().properties[0]]),
        /Duplicate/
    );
});
test('Display Search matches composition, layer, instance and matchName using memory only', () => {
    const h = fixture();
    h.glow();
    h.scan();
    const s = h.scanner.inventory();
    for (const method of [
        'project',
        'capture',
        'resolve',
        'inventory',
        'scanNext'
    ]) {
        h.adapter[method] = () => {
            throw Error('Unexpected host read');
        };
    }
    for (const q of [
        s.instances[0].compName.toUpperCase(),
        'text',
        'gloW',
        'ADBE glo'
    ]) {
        assert.ok(h.FX.Filters.search(s, q).instances.length > 0, q);
    }
    assert.equal(h.FX.Filters.search(s, 'nonexistent').instances.length, 0);
    assert.equal(s.instances.length, 18);
});
