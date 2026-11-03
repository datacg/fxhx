const test = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    path = require('node:path');
const { fixture, config, plain } = require('./helpers.cjs');
function finish(scanner) {
    let n = 10000;
    while (scanner.tick() && n-- > 0) {}
    assert.ok(n > 0, 'bounded scan');
    return scanner.result;
}
function basic(h, scope = 'entire', ids) {
    h.scanner.start(scope, ids);
    return finish(h.scanner);
}
function analyze(h, filters = {}) {
    h.scanner.analyze(filters);
    return finish(h.scanner);
}
function add(h, c, name, type = h.AVLayer, options = {}) {
    const l = c.addLayer(type, name, options);
    const e = h.effect(l, 'ADBE Glo2', 6);
    l.parade.effects.push(e);
    return { l, e };
}
// Tripwires throw at the attempted host mutation; the counters also detect an exception swallowed by product code.
function readonlyHost(h) {
    const mutations = [],
        reads = [],
        deep = [];
    const fail = (name) => {
        mutations.push(name);
        throw Error('READ-ONLY HOST VIOLATION: ' + name);
    };
    function readonly(o, key, label, countRead = false) {
        const value = o[key];
        Object.defineProperty(o, key, {
            configurable: true,
            get() {
                if (countRead) reads.push(label);
                return value;
            },
            set() {
                fail(label);
            }
        });
    }
    h.app.beginUndoGroup = () => fail('beginUndoGroup');
    h.app.project.items.addComp = () => fail('addComp');
    for (const c of h.app.project.items) {
        for (const l of c.layers) {
            for (const key of [
                'selected',
                'locked',
                'enabled',
                'label',
                'name',
                'adjustmentLayer'
            ])
                readonly(l, key, 'layer.' + key);
            l.parade.addProperty = () => fail('addProperty');
            for (const e of l.parade.effects) {
                const originalProperty = e.property;
                e.property = function (i) {
                    deep.push(l.name + '/' + e.name);
                    return originalProperty.call(this, i);
                };
                e.remove = () => fail('effect.remove');
                readonly(e, 'enabled', 'effect.enabled');
                readonly(e, 'name', 'effect.name');
                for (const p of e.children) {
                    readonly(
                        p,
                        'value',
                        l.name + '/' + e.name + '/' + p.matchName,
                        true
                    );
                    readonly(p, 'expression', 'property.expression');
                    readonly(
                        p,
                        'expressionEnabled',
                        'property.expressionEnabled'
                    );
                    for (const fn of [
                        'setValue',
                        'setValueAtTime',
                        'removeKey'
                    ])
                        p[fn] = () => fail(fn);
                }
            }
        }
    }
    return { mutations, reads, deep };
}
test('Basic Scan reads only metadata: no values, traversal, fingerprints, mutation, inventory or automatic analysis', () => {
    const h = fixture(),
        c = h.glow();
    c.addLayer(h.AVLayer, 'Empty');
    const watch = readonlyHost(h);
    h.adapter.capture = () => {
        throw Error('Basic Scan must never capture');
    };
    h.FX.Config.fingerprint = () => {
        throw Error('Basic Scan must never fingerprint');
    };
    h.adapter.inventory = () => {
        throw Error('Inventory selector must not run');
    };
    const s = basic(h);
    assert.equal(s.analysisState, 'basic');
    assert.equal(s.instances.length, 18);
    assert.equal(s.layers.length, 19);
    assert.ok(
        s.instances.every(
            (x) => x.configuration === null && x.fingerprint === null
        )
    );
    assert.equal(watch.reads.length, 0);
    assert.equal(watch.deep.length, 0);
    assert.deepEqual(watch.mutations, []);
    assert.equal(h.FX.Grouping.build(s.instances, 'effect').length, 1);
    assert.equal(h.FX.Grouping.build(s.instances, 'type').length, 2);
    assert.ok(
        h.FX.Grouping.build(s.instances, 'config').every(
            (g) => g.matchStatus === 'Not Analyzed'
        )
    );
});
test('composition, type, label, name, presence and effect-name/state filters precede every deep read', () => {
    const h = fixture(),
        a = h.comp('A'),
        b = h.comp('B');
    const wanted = add(h, a, 'Color target', h.AVLayer, {
        label: 5,
        adjustmentLayer: true
    });
    const neighbour = h.effect(wanted.l, 'Commercial Vendor');
    neighbour.name = 'Commercial';
    wanted.l.parade.effects.push(neighbour);
    add(h, a, 'Color wrong label', h.AVLayer, {
        label: 6,
        adjustmentLayer: true
    });
    add(h, a, 'Other name', h.AVLayer, { label: 5, adjustmentLayer: true });
    add(h, a, 'Color text', h.TextLayer, { label: 5 });
    add(h, b, 'Color other comp', h.AVLayer, {
        label: 5,
        adjustmentLayer: true
    });
    const disabled = add(h, a, 'Color disabled', h.AVLayer, {
        label: 5,
        adjustmentLayer: true
    });
    disabled.e.enabled = false;
    const watch = readonlyHost(h);
    basic(h);
    const s = analyze(h, {
        compName: 'A',
        type: 'Adjustment',
        label: 5,
        name: 'color',
        effect: 'glow',
        effectMode: 'has',
        effectEnabled: true
    });
    assert.equal(s.instances.length, 1);
    assert.equal(s.instances[0].layerName, 'Color target');
    assert.ok(watch.reads.length > 0);
    assert.ok(watch.reads.every((x) => x.startsWith('Color target/Glow/')));
    assert.ok(watch.deep.every((x) => x === 'Color target/Glow'));
    assert.deepEqual(watch.mutations, []);
});
test('property value filters read only the requested path on rejected candidates, then capture accepted occurrences', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Accept'),
        b = add(h, c, 'Reject');
    b.e.property(1).value = 7;
    const watch = readonlyHost(h);
    basic(h);
    const s = analyze(h, { effect: 'glow', property: config(6).properties[0] });
    assert.equal(s.instances.length, 1);
    assert.ok(watch.reads.includes('Reject/Glow/Intensity'));
    assert.ok(!watch.reads.includes('Reject/Glow/Radius'));
    assert.ok(watch.reads.includes('Accept/Glow/Radius'));
    assert.deepEqual(watch.mutations, []);
});
test('no-effect filter and scopes exclude all irrelevant property values', () => {
    const h = fixture(),
        a = h.comp('A'),
        b = h.comp('B');
    a.addLayer();
    add(h, b, 'Commercial elsewhere');
    const watch = readonlyHost(h);
    basic(h, 'manual', [a.id]);
    const s = analyze(h, { effectMode: 'none' });
    assert.equal(s.layers.length, 1);
    assert.equal(s.instances.length, 0);
    assert.equal(watch.reads.length, 0);
    assert.equal(watch.deep.length, 0);
    assert.deepEqual(watch.mutations, []);
});
test('Configuration Analysis rechecks layer/effect metadata before capture when metadata changes between levels', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Target'),
        b = add(h, c, 'Other');
    basic(h);
    a.e.enabled = false;
    b.l.label = 7;
    const watch = readonlyHost(h);
    const s = analyze(h, { effectEnabled: true, label: 5 });
    assert.equal(s.instances.length, 0);
    assert.equal(watch.reads.length, 0);
    assert.deepEqual(watch.mutations, []);
});
test('incompatible and animated properties are skipped without reading opaque values; reasons are retained', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Safe');
    a.e.children.push(
        h.prop('Opaque', 0, 'CUSTOM_VALUE'),
        h.prop('Keys', 2, 'OneD', { numKeys: 2 }),
        h.prop('Expr', 3, 'OneD', { expression: 'time' })
    );
    a.e.numProperties = a.e.children.length;
    const watch = readonlyHost(h);
    basic(h);
    const s = analyze(h, { effect: 'glow' }),
        reasons = plain(s.instances[0].configuration.unsupported).map(
            (x) => x.reason
        );
    assert.deepEqual(reasons, ['custom', 'keyframed', 'expression']);
    assert.ok(watch.reads.every((x) => /Intensity|Radius|Keys/.test(x)));
    assert.equal(s.instances[0].configuration.states.find(x => x.name === 'Keys').currentValue, 2);
    assert.ok(h.adapter.diagnostics.entries.some((x) => x.code === 'custom'));
    assert.deepEqual(watch.mutations, []);
});
test('structural revalidation reads neighbour identity only; configuration checks concern selected targets', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Layer');
    const neighbour = h.effect(a.l, 'Commercial Vendor');
    neighbour.name = 'Commercial';
    a.l.parade.effects.push(neighbour);
    basic(h);
    const s = analyze(h, { effect: 'glow' }),
        target = s.instances[0];
    let deep = 0;
    neighbour.property = () => {
        deep++;
        throw Error('Neighbour properties must not be read');
    };
    const r = h.batch.execute(
        h.batch.preview([target], 'set', { rows: [config(9).properties[0]] })
    );
    assert.equal(r.changed, 1);
    assert.equal(deep, 0);
    assert.equal(neighbour.children[0].value, 6);
});
test('changed selected occurrence aborts all writes, even when every layer structure is unchanged', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'A'),
        b = add(h, c, 'B');
    basic(h);
    const s = analyze(h, { effect: 'glow' }),
        plan = h.batch.preview(s.instances, 'disable', {});
    b.e.property(1).value = 8;
    assert.throws(() => h.batch.execute(plan), /Configuration changed/);
    assert.equal(a.e.enabled, true);
    assert.equal(h.calls.filter((x) => x[0] === 'begin').length, 0);
});
test('same-name duplicate effects require configuration analysis for Basic mutations and still detect swapped configurations', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Layer');
    a.l.parade.effects.push(h.effect(a.l, 'ADBE Glo2', 7));
    let s = basic(h),
        plan = h.batch.preview([s.instances[0]], 'remove', {});
    assert.throws(() => h.batch.execute(plan), /Configuration Analysis/);
    assert.equal(a.l.parade.numProperties, 2);
    s = basic(h);
    s = analyze(h, { effect: 'glow' });
    plan = h.batch.preview([s.instances[0]], 'remove', {});
    a.l.parade.effects.reverse();
    assert.throws(() => h.batch.execute(plan), /Configuration changed/);
    assert.equal(a.l.parade.numProperties, 2);
});
test('structural changes still abort batch application without reading neighbour values', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Layer');
    const s = basic(h),
        plan = h.batch.preview(s.layers, 'apply', {
            matchName: 'ADBE Slider Control'
        });
    a.l.parade.effects.push(h.effect(a.l, 'ADBE Glo2'));
    assert.throws(() => h.batch.execute(plan), /stack changed/);
    assert.equal(a.l.parade.numProperties, 2);
});
test('cancelled analysis publishes no partial configurations and cancels scheduled work', () => {
    const h = fixture();
    h.glow();
    basic(h);
    h.scanner.analyze({ effect: 'glow' });
    h.scanner.task = h.adapter.schedule('fixture');
    h.scanner.cancel();
    assert.equal(h.tasks.size, 0);
    assert.equal(h.scanner.result, null);
    assert.ok(
        h.scanner.current().instances.every((x) => x.configuration === null)
    );
    const s = analyze(h, { effect: 'glow' });
    assert.equal(s.instances.length, 18);
});
test('project switches during analysis invalidate the inventory and pending jobs', () => {
    const h = fixture();
    h.glow();
    basic(h);
    h.scanner.analyze({});
    h.app.project = {};
    assert.throws(() => h.scanner.tick(), /Project changed/);
    assert.equal(h.scanner.job, null);
    assert.equal(h.scanner.basic.stale, true);
});
test('cancellation from a progress callback never publishes a completed or partial scan', () => {
    const h = fixture();
    h.glow();
    h.scanner.start('entire');
    h.scanner.onProgress = () => h.scanner.cancel();
    assert.equal(h.scanner.tick(), false);
    assert.equal(h.scanner.result, null);
    assert.equal(h.scanner.basic, null);
});
test('native integration fixture refuses by default before host reads, file writes or process changes', () => {
    const vm = require('node:vm'),
        source = fs.readFileSync(
            path.join(__dirname, 'ae-smoke-body.jsx'),
            'utf8'
        );
    let touches = 0;
    const app = new Proxy(
        {},
        {
            get() {
                touches++;
                throw Error('Host accessed');
            },
            set() {
                touches++;
                throw Error('Host changed');
            }
        }
    );
    assert.throws(
        () =>
            vm.runInNewContext(source, {
                FX: { HostTestOptIn: false },
                app,
                File: function () {
                    touches++;
                    throw Error('File accessed');
                }
            }),
        /on hold/
    );
    assert.equal(touches, 0);
    assert.ok(!/app\.(exitCode|exitAfterLaunchAndEval)\s*=/.test(source));
    const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
    );
    assert.ok(
        Object.values(pkg.scripts).every(
            (command) => !/afterfx|aerender|Start-Process/i.test(command)
        )
    );
});
test('scanner suppresses reentrant progress ticks and cancels safely even if scheduler cancellation fails', () => {
    const h = fixture();
    h.glow();
    h.scanner.start('entire');
    let recursive = 0;
    h.scanner.onProgress = () => {
        recursive++;
        assert.equal(h.scanner.tick(), false);
    };
    finish(h.scanner);
    assert.ok(recursive > 0);
    assert.equal(h.scanner.ticking, false);
    h.scanner.analyze({});
    h.scanner.task = 123;
    h.adapter.cancelTask = () => {
        throw Error('Host cancellation failure');
    };
    h.scanner.cancel();
    assert.equal(h.scanner.job, null);
    assert.equal(h.scanner.task, null);
    assert.ok(
        h.adapter.diagnostics.entries.some((x) => x.code === 'cancel-failed')
    );
});
test('bounded analysis history does not freeze revision or discard inventory after repeated targeted analyses', () => {
    const h = fixture();
    h.glow();
    basic(h);
    const target = h.scanner.basic.instances[0];
    for (let i = 0; i < 21; i++) {
        h.scanner.analyze({}, [target]);
        finish(h.scanner);
    }
    assert.equal(h.scanner.analyses.length, 20);
    assert.equal(h.scanner.analysisRevision, 21);
    assert.equal(h.scanner.inventory().instances.length, 18);
    assert.equal(Object.keys(h.scanner.configurations).length, 1);
});
test('unknown animation discovery is read only, scoped to authorized targets and retains nonmatching captured classifications', () => {
    const h = fixture(),
        c = h.comp(),
        a = add(h, c, 'Animated'),
        b = add(h, c, 'Static'),
        outside = add(h, c, 'Outside');
    a.e.property(1).numKeys = 2;
    const watch = readonlyHost(h);
    basic(h);
    const authorized = h.scanner.basic.instances.filter(
        (x) => x.layerName !== 'Outside'
    );
    h.scanner.analyze({ animation: 'Animated' }, authorized);
    finish(h.scanner);
    assert.equal(h.scanner.result.instances.length, 1);
    assert.equal(h.scanner.result.instances[0].layerName, 'Animated');
    const inventory = h.scanner.inventory();
    assert.equal(inventory.instances.filter((x) => x.configuration).length, 2);
    assert.equal(
        h.FX.Animation.matches(
            inventory.instances.find((x) => x.layerName === 'Static')
                .configuration,
            'Static'
        ),
        true
    );
    assert.ok(watch.deep.every((x) => !x.includes('Outside')));
    assert.deepEqual(watch.mutations, []);
    const display = h.FX.Filters.apply(
        h.scanner.basic,
        { animation: 'Animated' },
        false,
        true
    );
    assert.equal(display.instances.length, 3);
    assert.equal(
        h.FX.Filters.apply(h.scanner.basic, { animation: 'Animated' }).instances
            .length,
        0
    );
});
