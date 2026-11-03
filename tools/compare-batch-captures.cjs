// Node mocks only. No AE launch, plugin binary, host API or commercial fixture.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { fixture, config } = require('../tests/helpers.cjs');
const baseline = '1ae5edb';
function historical(file) {
    const result = spawnSync('git', ['show', baseline + ':' + file], {
        cwd: require('node:path').resolve(__dirname, '..'),
        encoding: 'utf8',
        windowsHide: true
    });
    if (result.status !== 0)
        throw Error('Baseline source unavailable: ' + file);
    return result.stdout;
}
function measure(legacy) {
    const h = fixture();
    if (legacy) {
        vm.runInNewContext(historical('src/ae/adapter.js'), h);
        vm.runInNewContext(historical('src/batch/batch.js'), h);
    }
    let clock = 0,
        slowReads = 0,
        captures = 0;
    h.FX.U.now = () => clock;
    const l = h.comp().addLayer();
    for (let n = 0; n < 3; n++) {
        const props = Array.from({ length: 48 }, (_, i) =>
            h.prop(i ? 'P' + i : 'Intensity', i ? i : 50)
        );
        const opaque = h.prop('Opaque', 0, 'CUSTOM_VALUE');
        Object.defineProperty(opaque, 'value', {
            get() {
                throw Error('Must never read opaque value');
            }
        });
        const inaccessible = h.prop('Inaccessible', 0);
        Object.defineProperty(inaccessible, 'value', {
            get() {
                clock += 5;
                throw Error('Simulated inaccessible value');
            }
        });
        Object.defineProperty(props[47], 'value', {
            get() {
                clock += 7;
                slowReads++;
                return 47;
            }
        });
        props.push(opaque, inaccessible);
        const effect = h.effect(l, 'SIMULATED Third Party', 50, props);
        effect.name = 'Simulated ' + n;
        l.parade.effects.push(effect);
    }
    const adapter = new h.FX.AfterEffectsAdapter(new h.FX.Diagnostics());
    const capture = adapter.capture;
    adapter.capture = function (...args) {
        captures++;
        return capture.apply(this, args);
    };
    const scanner = new h.FX.Scanner(adapter);
    scanner.start('entire');
    while (scanner.tick()) {}
    scanner.analyze({});
    while (scanner.tick()) {}
    captures = 0;
    slowReads = 0;
    const started = clock,
        batch = new h.FX.Batch(adapter, scanner);
    const report = batch.execute(
        batch.preview(scanner.current().instances, 'set', {
            rows: [config(70).properties[0]]
        })
    );
    assert.equal(captures, 6);
    assert.equal(slowReads, 6);
    assert.equal(report.written, 3);
    assert.equal(report.failed, 0);
    return {
        code: legacy
            ? baseline + ' adapter + Batch'
            : 'working tree adapter + Batch',
        completeCaptures: captures,
        slowValueReads: slowReads,
        simulatedReadMs: clock - started,
        returnedWrites: report.written
    };
}
const result = {
    environment:
        'Node mocks; historical adapter/Batch + shared scanner/harness; no After Effects',
    baseline: measure(true),
    current: measure(false)
};
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync(
    'artifacts/batch-captures-comparison-0.1.3.json',
    JSON.stringify(result, null, 2) + '\n'
);
console.log(JSON.stringify(result, null, 2));
