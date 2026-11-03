const test = require('node:test'),
    assert = require('node:assert/strict');
const { fixture, config, plain } = require('./helpers.cjs');
test('capture safely distinguishes animation, disabled expressions, opaque values and contextual references', () => {
    const h = fixture(),
        l = h.comp().addLayer();
    const opaque = h.prop('Opaque', 0, 'CUSTOM_VALUE');
    Object.defineProperty(opaque, 'value', {
        get() {
            throw Error('must not read');
        }
    });
    const e = h.effect(l, 'ADBE Glo2', 6, [
        h.prop('Intensity', 6),
        h.prop('Anim', 2, 'OneD', { numKeys: 2 }),
        h.prop('Expr', 3, 'OneD', {
            expression: 'time',
            expressionEnabled: false
        }),
        opaque,
        h.prop('Ref', 1, 'LAYER_INDEX')
    ]);
    const c = h.adapter.capture(e);
    assert.equal(c.properties.length, 1);
    assert.deepEqual(
        plain(c.unsupported).map((x) => x.reason),
        ['keyframed', 'expression', 'custom', 'reference']
    );
});
test('static writes preserve keys and disabled expressions, and never change other properties or enabled state', () => {
    const h = fixture(),
        l = h.comp().addLayer(),
        e = l.parade.addProperty('ADBE Glo2');
    e.enabled = false;
    e.property(1).numKeys = 2;
    let r = h.adapter.writeRows(e, [config(9).properties[0]]);
    assert.equal(r.skipped, 1);
    e.property(1).numKeys = 0;
    e.property(1).expression = 'value*2';
    r = h.adapter.writeRows(e, [config(9).properties[0]]);
    assert.equal(r.skipped, 1);
    e.property(1).expression = '';
    r = h.adapter.writeRows(e, [config(9).properties[0]]);
    assert.equal(r.written, 1);
    assert.equal(e.property(1).value, 9);
    assert.equal(e.property(2).value, 80);
    assert.equal(e.enabled, false);
});
test('same-name property paths use index; ambiguous fallback refuses writes', () => {
    const h = fixture(),
        l = h.comp().addLayer(),
        e = h.effect(l, 'ADBE Glo2', 6, [
            h.prop('Duplicate', 1),
            h.prop('Duplicate', 2)
        ]);
    assert.equal(
        h.adapter.resolveProperty(e, [{ matchName: 'Duplicate', index: 2 }])
            .value,
        2
    );
    assert.throws(
        () =>
            h.adapter.resolveProperty(e, [
                { matchName: 'Duplicate', index: 3 }
            ]),
        /Ambiguous/
    );
});
test('layer classification uses subclasses and documented explicit precedence; independent flags survive', () => {
    const h = fixture(),
        c = h.comp();
    const text = c.addLayer(h.TextLayer, 'Text', {
        adjustmentLayer: true,
        threeDLayer: true
    });
    assert.equal(h.adapter.layerRecord(c, text, 'scan').layerType, 'Text');
    assert.equal(h.adapter.layerRecord(c, text, 'scan').adjustment, true);
    assert.equal(h.adapter.layerRecord(c, text, 'scan').threeD, true);
    assert.equal(h.adapter.layerType(c.addLayer(h.CameraLayer)), 'Camera');
    assert.equal(h.adapter.layerType(c.addLayer(h.LightLayer)), 'Light');
    assert.equal(h.adapter.layerType(c.addLayer(h.ShapeLayer)), 'Shape');
    assert.equal(
        h.adapter.layerType(
            c.addLayer(h.AVLayer, 'Solid', { source: new h.FootageItem(true) })
        ),
        'Solid'
    );
});
test('scopes select only requested compositions; empty entire project completes normally', () => {
    const h = fixture(),
        a = h.comp('A'),
        b = h.comp('B');
    a.addLayer();
    b.addLayer();
    assert.equal(h.scan('active').layers[0].compName, 'A');
    h.app.project.selection = [b];
    assert.equal(h.scan('selected').layers[0].compName, 'B');
    assert.equal(h.scan('manual', [a.id]).layers[0].compName, 'A');
    h.app.project.selection = [];
    assert.throws(() => h.scan('selected'), /Choose/);
    const empty = fixture();
    assert.equal(empty.scan().layers.length, 0);
});
test('cancelled scans do not expose partial results or abandon scheduled tasks', () => {
    const h = fixture();
    h.glow();
    h.scanner.start('entire');
    h.scanner.task = h.adapter.schedule('fixture');
    assert.equal(h.tasks.size, 1);
    h.scanner.cancel();
    assert.equal(h.tasks.size, 0);
    assert.equal(h.scanner.result, null);
    assert.throws(() => h.scanner.current(), /fresh/);
});
test('stack changes and removed targets abort all writes before touching valid earlier targets', () => {
    const h = fixture(),
        c = h.glow(),
        s = h.scan();
    const plan = h.batch.preview(s.instances, 'disable', {});
    c.layers[17].parade.effects[0].property(1).value = 99;
    assert.throws(() => h.batch.execute(plan), /changed/);
    assert.equal(c.layers[0].parade.effects[0].enabled, true);
    assert.equal(h.calls.filter((x) => x[0] === 'begin').length, 0);
});
test('duplicate effects are removed descending, locked layers explicitly skipped, Undo always closes', () => {
    const h = fixture(),
        c = h.comp(),
        a = c.addLayer(),
        b = c.addLayer();
    for (let i = 0; i < 3; i++) a.parade.addProperty('ADBE Glo2');
    b.parade.addProperty('ADBE Glo2');
    const s = h.scan();
    b.locked = true;
    const r = h.batch.execute(h.batch.preview(s.instances, 'remove', {}));
    assert.equal(r.changed, 3);
    assert.equal(r.skipped, 1);
    assert.equal(a.parade.numProperties, 0);
    assert.equal(b.parade.numProperties, 1);
    assert.deepEqual(
        h.calls.filter((x) => x[0] === 'remove').map((x) => x[1]),
        [3, 2, 1]
    );
    assert.equal(h.calls.at(-1)[0], 'end');
    assert.throws(() =>
        h.adapter.undo('fail', () => {
            throw Error('fixture');
        })
    );
    assert.equal(h.calls.at(-1)[0], 'end');
});
test('apply supports layers without effects, continues after incompatibility, and invalidates the scan', () => {
    const h = fixture(),
        c = h.comp(),
        a = c.addLayer(),
        b = c.addLayer();
    a.incompatible = true;
    const s = h.scan();
    const r = h.batch.execute(
        h.batch.preview(s.layers, 'apply', { matchName: 'ADBE Slider Control' })
    );
    assert.equal(r.changed, 1);
    assert.equal(r.failed, 1);
    assert.equal(r.issues.length, 1);
    assert.equal(b.parade.numProperties, 1);
    assert.equal(h.scanner.result.stale, true);
});
test('copy selected rows reports partial success and protects unselected/animated values', () => {
    const h = fixture(),
        c = h.comp(),
        l = c.addLayer(),
        e = l.parade.addProperty('ADBE Glo2');
    e.property(2).numKeys = 2;
    const s = h.scan();
    let r = h.batch.execute(
        h.batch.preview(s.instances, 'copy', { rows: config(12).properties })
    );
    assert.equal(r.changed, 1);
    assert.equal(r.written, 1);
    assert.equal(r.propertiesSkipped, 1);
    assert.equal(e.property(1).value, 12);
    assert.equal(e.property(2).value, 80);
    assert.equal(r.issues.length, 1);
});
test('property failures are reported without aborting later targets; bounds validated before writing', () => {
    const h = fixture(),
        c = h.comp(),
        a = c.addLayer(),
        b = c.addLayer(),
        e = a.parade.addProperty('ADBE Glo2');
    b.parade.addProperty('ADBE Glo2');
    e.property(1).hasMax = true;
    e.property(1).maxValue = 8;
    const s = h.scan(),
        r = h.batch.execute(
            h.batch.preview(s.instances, 'set', {
                rows: [config(9).properties[0]]
            })
        );
    assert.equal(r.failed, 1);
    assert.equal(r.changed, 1);
    assert.equal(e.property(1).value, 6);
});
test('locate and timeline selection navigate only one composition at a time', () => {
    const h = fixture(),
        a = h.comp('A'),
        b = h.comp('B');
    a.addLayer();
    a.addLayer();
    b.addLayer();
    const s = h.scan();
    h.adapter.selectLayers(s.layers);
    assert.equal(h.app.project.activeItem, a);
    assert.equal(a.layers.filter((x) => x.selected).length, 2);
    assert.equal(b.layers[0].selected, false);
    h.adapter.locate(s.layers[2]);
    assert.equal(h.app.project.activeItem, b);
    assert.equal(b.layers[0].selected, true);
});
test('project switches and stale scans refuse operations; duplicate targets are rejected', () => {
    const h = fixture();
    h.glow();
    const s = h.scan();
    assert.throws(
        () => h.batch.preview([s.instances[0], s.instances[0]], 'disable', {}),
        /Duplicate/
    );
    h.scanner.invalidate();
    assert.throws(() => h.batch.preview(s.instances, 'disable', {}), /fresh/);
    h.scan();
    h.app.project = {};
    assert.throws(() => h.scanner.current(), /fresh/);
});
