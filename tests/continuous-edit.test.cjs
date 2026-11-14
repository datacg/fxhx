const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { ui } = require('./ui-harness.cjs');

function setup(options = {}) {
    const h = ui(options), comp = h.glow(), p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[16]);
    h.pick(p, h.results(p).items[17], { ctrlKey: true });
    h.read(p);
    h.drain(p);
    return { h, comp, p };
}
function edit(h, p, value, parameter = 0) {
    h.dialogHooks['Edit Parameters'] = d => {
        const list = h.all(d, 'listbox')[0];
        list.selection = parameter;
        list.onChange();
        const input = h.parameterFields(d)[0];
        input.text = String(value);
        input.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
}
function nextTick(h, p) {
    const scanner = p.fxController.scanner;
    const code = h.tasks.get(scanner.task);
    assert.ok(code);
    h.tasks.delete(scanner.task);
    vm.runInNewContext(code, h.$.global);
}
function reachReadPhase(h, p) {
    let remaining = 100;
    while (p.fxController.scanner.job.phase === 'basic' && remaining-- > 0) nextTick(h, p);
    assert.ok(remaining > 0);
    assert.equal(p.fxController.scanner.job.phase, 'configuration');
}

test('two consecutive edits keep selection, current values and Results without another Scan or Read Parameters click', () => {
    const { h, comp, p } = setup();
    edit(h, p, 12);
    const report = p.fxController.batch.lastReport;
    h.drain(p);
    assert.equal(p.fxController.selected().instances.length, 2);
    assert.ok(p.fxController.selected().instances.every(e => e.configuration.properties[0].value === 12));
    assert.equal(p.fxController.batch.lastReport, report);
    assert.match(h.all(p, 'statictext').find(c => /Ready to continue/.test(c.text)).text, /Parameters updated for 2\/2/);
    assert.ok(h.all(p, 'button').some(b => b.text === 'Edit Parameters...' && b.enabled));
    assert.equal(h.windows.filter(w => w.text === 'Edit Parameters').length, 1); // no automatic modal
    edit(h, p, 92, 1);
    h.drain(p);
    for (let i = 0; i < 18; i++) {
        assert.equal(comp.layers[i].parade.property(1).property(1).value, i >= 16 ? 12 : i < 3 ? 50 : i < 15 ? 6 : 7);
        assert.equal(comp.layers[i].parade.property(1).property(2).value, i >= 16 ? 92 : 80);
    }
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 4);
    assert.equal(h.tasks.size, 0);
});

test('automatic parameter reads are limited to the exact recovered edited occurrences', () => {
    const { h, comp, p } = setup();
    edit(h, p, 9);
    const capture = h.adapter.capture, reads = [];
    h.adapter.capture = function (effect, ...args) {
        assert.ok([comp.layers[16].parade.property(1), comp.layers[17].parade.property(1)].includes(effect));
        reads.push(effect);
        return capture.call(this, effect, ...args);
    };
    h.drain(p);
    assert.equal(reads.length, 2);
    assert.equal(p.fxController.scanner.inventory().instances.filter(e => e.configuration).length, 2);
});

test('cancelling the post-edit read preserves applied changes and Results without retrying writes', () => {
    const { h, comp, p } = setup();
    edit(h, p, 9);
    reachReadPhase(h, p);
    const report = p.fxController.batch.lastReport;
    let reads = 0;
    h.adapter.capture = () => { reads++; throw Error('Cancelled reads must not run'); };
    h.click(p, 'Cancel');
    assert.equal(reads, 0);
    assert.equal(comp.layers[17].parade.property(1).property(1).value, 9);
    assert.equal(p.fxController.batch.lastReport, report);
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 2);
    assert.equal(p.fxController.scanner.job, null);
    assert.equal(h.tasks.size, 0);
    assert.ok(h.all(p, 'statictext').some(c => /Changes were applied.*cancelled/.test(c.text)));
});

test('failure to start the read leaves the successful write report and an explicit retry action', () => {
    const { h, comp, p } = setup();
    p.fxController.scanner.analyze = () => { throw Error('Cannot start follow-up read'); };
    edit(h, p, 9);
    h.drain(p);
    assert.equal(comp.layers[17].parade.property(1).property(1).value, 9);
    assert.equal(p.fxController.batch.lastReport.verified, 2);
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 2);
    assert.equal(p.fxController.scanner.job, null);
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.ok(h.all(p, 'button').some(b => b.text === 'Edit Parameters...' && b.enabled));
    assert.ok(h.all(p, 'statictext').some(c => /Parameters could not be updated/.test(c.text)));
});

test('a host error during the follow-up read never discards Results or retries the successful writes', () => {
    const { h, comp, p } = setup();
    edit(h, p, 9);
    const report = p.fxController.batch.lastReport;
    h.adapter.capture = () => { throw Error('Read failed after successful edit'); };
    h.drain(p);
    assert.equal(comp.layers[17].parade.property(1).property(1).value, 9);
    assert.equal(p.fxController.batch.lastReport, report);
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 2);
    assert.equal(p.fxController.scanner.basic.stale, true);
    assert.equal(h.tasks.size, 0);
    assert.ok(h.all(p, 'button').some(b => b.text === 'Results...' && b.enabled));
});

test('switching projects before the follow-up read cancels the old targets without host reads', () => {
    const { h, p } = setup();
    edit(h, p, 9);
    reachReadPhase(h, p);
    let reads = 0;
    h.adapter.capture = () => { reads++; throw Error('No old project reads'); };
    h.app.project = { items: [], numItems: 0, activeItem: null };
    h.drain(p);
    assert.equal(reads, 0);
    assert.equal(p.fxController.scanner.job, null);
    assert.equal(h.tasks.size, 0);
    assert.equal(p.fxController.batch.lastReport.verified, 2);
});

test('manual Refresh after an edit with auto refresh disabled remains a shallow explicit inventory', () => {
    const { h, p } = setup({ autoRefresh: false });
    edit(h, p, 9);
    h.adapter.capture = () => { throw Error('Manual Refresh must not read parameters'); };
    h.click(p, 'Refresh');
    h.drain(p);
    assert.equal(p.fxController.selected().instances.length, 2);
    assert.ok(p.fxController.selected().instances.every(e => !e.configuration));
    assert.ok(h.all(p, 'button').some(b => b.text === 'Edit Parameters...' && b.enabled));
});

test('ambiguous duplicate effects are never rebound or automatically reread', () => {
    const h = ui(), comp = h.comp(), layer = comp.addLayer();
    layer.parade.addProperty('ADBE Glo2');
    layer.parade.addProperty('ADBE Glo2');
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    h.read(p);
    h.drain(p);
    edit(h, p, 12);
    h.adapter.capture = () => { throw Error('Ambiguous effects cannot be reread automatically'); };
    h.drain(p);
    assert.equal(p.fxController.selected().instances.length, 0);
    assert.equal(p.fxController.batch.lastReport.verified, 1);
    assert.equal(layer.parade.property(2).property(1).value, 6);
    assert.equal(h.tasks.size, 0);
    // The edited occurrence keeps no stale configuration; it needs an explicit read.
    assert.ok(!p.fxController.scanner.inventory().instances.find(e => e.effectIndex === 1).configuration);
});

test('a continued edit preserves the page and the identifiable focused occurrence', () => {
    const h = ui(), comp = h.comp();
    for (let i = 0; i < 205; i++) comp.addLayer(undefined, 'Layer ' + i).parade.addProperty('ADBE Glo2');
    const p = h.start();
    h.scan(p);
    h.click(p, 'Next');
    const target = h.results(p).items[2].fxData.instances[0];
    h.pick(p, h.results(p).items[2]);
    h.read(p);
    h.drain(p);
    edit(h, p, 12);
    h.drain(p);
    assert.ok(h.all(p, 'statictext').some(c => c.text === '201-205 / 205'));
    assert.equal(p.fxController.selected().instances[0].layerId, target.layerId);
    assert.equal(h.results(p).selection.fxData.instances[0].layerId, target.layerId);
});

test('rereading respects the selected work targets and explains effects that cease matching a filter', () => {
    const h = ui(), comp = h.comp(), layer = comp.addLayer();
    const parameter = h.prop('Intensity', 5, 'OneD', { numKeys: 2 });
    parameter.removeKey = () => { parameter.numKeys--; };
    layer.parade.effects.push(h.effect(layer, 'ADBE Glo2', 0, [parameter]));
    const p = h.start();
    h.scan(p);
    h.click(p, 'Select Results');
    h.read(p);
    h.drain(p);
    h.dialogHooks['Layer and effect filters'] = d => {
        const filter = h.all(d, 'dropdownlist').at(-1);
        filter.selection = 2; // Animated
        h.click(d, 'Use filters');
    };
    h.click(p, 'Filters...');
    h.setKeyframeConsent(true);
    h.dialogHooks['Edit Parameters'] = d => {
        const choice = h.all(d, 'checkbox')[0];
        choice.value = true;
        choice.onClick();
        const field = h.parameterFields(d)[0];
        field.text = '20';
        field.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    h.drain(p);
    assert.equal(parameter.numKeys, 0);
    assert.equal(parameter.value, 20);
    assert.equal(p.fxController.selected().instances.length, 0);
    assert.ok(h.all(p, 'statictext').some(c => /no longer match the current filters/.test(c.text)));
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 1);
});
