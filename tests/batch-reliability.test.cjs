const test = require('node:test'),
    assert = require('node:assert/strict');
const { fixture, config, plain } = require('./helpers.cjs');

test('write results distinguish skipped, pre-write failure, uncertain host write and failed readback', () => {
    for (const kind of [
        'before',
        'during',
        'after',
        'rounded',
        'verified',
        'animated'
    ]) {
        const h = fixture(),
            l = h.comp().addLayer(),
            e = l.parade.addProperty('ADBE Glo2');
        const p = e.property(1),
            row = config(70).properties[0];
        let value = 50,
            writes = 0;
        Object.defineProperty(p, 'value', {
            get() {
                if (kind === 'after' && writes)
                    throw Error('readback inaccessible');
                return value;
            }
        });
        p.setValue = (v) => {
            writes++;
            value = kind === 'rounded' ? Math.round(v) : v;
            if (kind === 'during')
                throw Error('write returned error after change');
        };
        if (kind === 'before') {
            p.hasMax = true;
            p.maxValue = 60;
        }
        if (kind === 'rounded') row.value = 70.4;
        if (kind === 'animated') p.numKeys = 2;
        const r = h.adapter.writeRows(e, [row]);
        const expected = {
            before: 'Failed Before Write',
            during: 'Unknown After Host Error',
            after: 'Written but Verification Failed',
            rounded: 'Written but Verification Failed',
            verified: 'Written and Verified',
            animated: 'Skipped'
        }[kind];
        assert.equal(r.outcomes[0].status, expected, kind);
        assert.equal(writes, ['before', 'animated'].includes(kind) ? 0 : 1);
        assert.equal(
            r.written,
            ['after', 'rounded', 'verified'].includes(kind) ? 1 : 0
        );
        assert.equal(r.unknown, kind === 'during' ? 1 : 0);
        if (writes) assert.ok(h.adapter.diagnostics.metrics.$setValue);
        if (['after', 'rounded', 'verified'].includes(kind))
            assert.ok(h.adapter.diagnostics.metrics.$readback);
        assert.equal(e.property(2).value, 80);
    }
});

function synthetic() {
    const h = fixture(),
        l = h.comp().addLayer(),
        effects = [];
    let clock = 0,
        reads = 0;
    h.FX.U.now = () => clock;
    for (let n = 0; n < 3; n++) {
        const props = Array.from({ length: 48 }, (_, i) =>
            h.prop(i ? 'P' + i : 'Intensity', i ? i : 50)
        );
        const opaque = h.prop('Opaque', 0, 'CUSTOM_VALUE');
        Object.defineProperty(opaque, 'value', {
            get() {
                throw Error('opaque must never be read');
            }
        });
        props.push(opaque);
        const inaccessible = h.prop('Inaccessible', 0);
        Object.defineProperty(inaccessible, 'value', {
            get() {
                clock += 5;
                throw Error('inaccessible');
            }
        });
        props.push(inaccessible);
        let slow = 47;
        Object.defineProperty(props[47], 'value', {
            get() {
                reads++;
                clock += 7;
                return slow;
            },
            set(v) {
                slow = v;
            }
        });
        const e = h.effect(l, 'SIMULATED Third Party', 50, props);
        e.name = 'Simulated ' + n;
        l.parade.effects.push(e);
        effects.push(e);
    }
    const scan = h.scan();
    return { h, l, effects, scan, reads: () => reads };
}
test('three synthetic partial effects keep six conservative captures, record slow reads and report partial writes accurately', () => {
    const { h, effects, scan, reads } = synthetic();
    const metrics = h.adapter.diagnostics.metrics;
    const captures = metrics.$capture.count,
        priorReads = reads();
    // Descending order: #3 succeeds, #2 changes then throws, #1 returns then readback fails.
    const second = effects[1].property(1),
        first = effects[0].property(1);
    second.setValue = (v) => {
        second.value = v;
        throw Error('host error after a prior successful target');
    };
    let value = 50,
        wrote = false;
    Object.defineProperty(first, 'value', {
        get() {
            if (wrote) throw Error('post-write read failure');
            return value;
        }
    });
    first.setValue = (v) => {
        value = v;
        wrote = true;
    };
    const r = h.batch.execute(
        h.batch.preview(scan.instances, 'set', {
            rows: [config(70).properties[0]]
        })
    );
    assert.equal(metrics.$capture.count - captures, 6);
    assert.equal(reads() - priorReads, 6);
    assert.equal(r.changed, 2);
    assert.equal(r.failed, 2);
    assert.equal(r.written, 2);
    assert.equal(r.verified, 1);
    assert.equal(r.verificationFailed, 1);
    assert.equal(r.unknown, 1);
    assert.deepEqual(plain(r.outcomes.map((x) => x.properties[0].status)), [
        'Written and Verified',
        'Unknown After Host Error',
        'Written but Verification Failed'
    ]);
    assert.equal(second.value, 70);
    assert.equal(effects[2].property(1).value, 70);
    assert.ok(effects.every((e) => e.property(2).value === 1 && e.enabled));
    assert.equal(h.scanner.basic.stale, true);
    assert.equal(h.batch.executing, false);
    assert.equal(h.calls.at(-1)[0], 'end');
    for (const key of [
        '$prevalidation',
        '$validateOccurrence',
        '$capture',
        '$setValue',
        '$readback',
        '$totalBatch'
    ])
        assert.ok(metrics[key], key);
    assert.equal(metrics.$capture.lastMs, 12);
    assert.equal(metrics.$validateOccurrence.lastMs, 12);
    assert.equal(metrics.$prevalidation.totalMs, 36);
    assert.equal(metrics.$totalBatch.totalMs, 72);
    const fs = require('node:fs');
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(
        'artifacts/batch-reliability-0.1.3.json',
        JSON.stringify(
            {
                environment: 'Node mocks; logical clock, not AE timing',
                capturesBefore: 6,
                capturesAfter: metrics.$capture.count - captures,
                slowValueReads: reads() - priorReads,
                changed: r.changed,
                verified: r.verified,
                verificationFailed: r.verificationFailed,
                unknown: r.unknown,
                metrics
            },
            null,
            2
        )
    );
});
test('immediate full validation catches unselected changes induced by a preceding write', () => {
    const { h, effects, scan } = synthetic();
    effects[2].property(1).setValue = (v) => {
        effects[2].property(1).value = v;
        effects[1].property(2).value = 999;
    };
    const r = h.batch.execute(
        h.batch.preview(scan.instances, 'set', {
            rows: [config(70).properties[0]]
        })
    );
    assert.equal(effects[1].property(1).value, 50);
    assert.equal(r.changed, 2);
    assert.equal(r.failed, 1);
    assert.match(r.issues[0].reason, /Configuration changed/);
});
test('batch rejects reentry and retains confirmed results when closing Undo fails', () => {
    const h = fixture();
    h.comp().addLayer().parade.addProperty('ADBE Glo2');
    const scan = h.scan(),
        plan = h.batch.preview(scan.instances, 'set', {
            rows: [config(70).properties[0]]
        });
    h.batch.onProgress = () =>
        assert.throws(() => h.batch.execute(plan), /already executing/);
    h.app.endUndoGroup = () => {
        throw Error('Undo close failed after write');
    };
    const r = h.batch.execute(plan);
    assert.equal(r.verified, 1);
    assert.equal(r.written, 1);
    assert.equal(r.unknown, 1);
    assert.equal(r.completed, false);
    assert.equal(h.batch.lastReport, r);
    assert.equal(h.scanner.basic.stale, true);
    assert.equal(h.batch.executing, false);
});
