const test = require('node:test'),
    assert = require('node:assert/strict');
const { ui } = require('./ui-harness.cjs');

test('default view shows individual occurrences and Help has no fake icon or selection dependency', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    assert.equal(h.all(p, 'dropdownlist')[1].selection.index, 7);
    assert.ok(!h.all(p, 'button').some((b) => b.text === '? Help'));
    h.click(p, 'Help');
    assert.ok(h.windows.some((w) => w.text === 'FX Exchanger Help'));
    h.scan(p);
    const tree = h.results(p);
    assert.equal(tree.items.length, 18);
    assert.ok(
        tree.items.every(
            (item) =>
                item.type === 'item' &&
                !item.items.length &&
                item.fxData.instances.length === 1
        )
    );
    assert.match(tree.items[0].text, /Main \/ Text 0 \/ 1. Glow/);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Parameters...').visible,
        false
    );
});

test('button callbacks do not traverse inaccessible native parents', () => {
    const h = ui();
    const p = h.start();
    Object.defineProperty(p, 'parent', {
        get() {
            throw Error('native parent unavailable');
        }
    });
    h.click(p, 'Help');
    assert.ok(h.windows.some((w) => w.text === 'FX Exchanger Help'));
    assert.equal(h.alerts.length, 0);
    assert.ok(
        !p.fxController.diagnostics.text().includes('native parent unavailable')
    );
});

test('clicking a matching individual result safely commits a pending word filter and enables actions', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const q = h.all(p, 'edittext')[0],
        tree = h.results(p);
    const intended = tree.items[17].fxData.instances[0];
    h.adapter.capture = () => {
        throw Error('selection must remain shallow');
    };
    q.text = 'Glow';
    q.onChanging();
    q.onChange();
    h.pick(p, tree.items[17]);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(
        h.FX.Model.effectKey(p.fxController.selected().instances[0]),
        h.FX.Model.effectKey(intended)
    );
    for (const title of [
        'Edit Parameters...',
        'Enable',
        'Disable',
        'Add Effect...',
        'More...'
    ]) {
        assert.equal(
            h.all(p, 'button').find((b) => b.text === title).enabled,
            true,
            title
        );
    }
    h.setConfirm(false);
    h.click(p, 'Disable');
    assert.match(
        h.confirmations.at(-1),
        /Affected: 1 effects \/ 1 layers \/ 1 compositions/
    );
    assert.equal(h.calls.filter((c) => c[0] === 'begin').length, 0);
});

test('a pending filter never authorizes a clicked occurrence that becomes hidden', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const q = h.all(p, 'edittext')[0],
        tree = h.results(p),
        old = tree.items[17];
    q.text = 'Text';
    q.onChanging();
    h.pick(p, old);
    assert.equal(tree.items.length, 3);
    assert.equal(p.fxController.selected().instances.length, 0);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Disable').enabled,
        false
    );
    h.pick(p, tree.items[0]);
    assert.equal(p.fxController.selected().instances[0].layerName, 'Text 0');
    h.click(p, 'Clear');
    assert.equal(tree.items.length, 18);
});

test('selection marks tolerate native label notifications and duplicate events without reentry', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p),
        item = tree.items[0];
    let writes = 0;
    let title = item.text;
    Object.defineProperty(item, 'text', {
        get: () => title,
        set(value) {
            writes++;
            title = value;
            tree.onChange();
        }
    });
    tree.selection = item;
    tree.control.listener_click({});
    tree.onChange();
    tree.control.listener_click({});
    assert.equal(writes, 1);
    assert.ok(item.text.startsWith('[x] '));
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Edit Parameters...').enabled,
        true
    );
});

test('individual workflow reads, edits and automatically reloads only the chosen effect', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[17]);
    let captures = 0;
    const capture = h.adapter.capture;
    h.adapter.capture = function (...args) {
        captures++;
        return capture.apply(this, args);
    };
    h.read(p);
    h.drain(p);
    assert.equal(captures, 1);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const f = h.parameterFields(d)[0];
        f.text = '9';
        f.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(c.layers[17].parade.property(1).property(1).value, 9);
    assert.equal(c.layers[16].parade.property(1).property(1).value, 7);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 1);
    const after = captures;
    h.drain(p);
    assert.equal(captures, after + 1);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(p.fxController.selected().instances[0].configuration.properties[0].value, 9);
});

test('direct enable and disable require confirmation but no parameter capture', () => {
    const h = ui(),
        c = h.glow(),
        p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[17]);
    h.adapter.capture = () => {
        throw Error('toggle must not analyze Basic metadata');
    };
    h.click(p, 'Disable');
    assert.equal(c.layers[17].parade.property(1).enabled, false);
    assert.equal(c.layers[16].parade.property(1).enabled, true);
    h.drain(p);
    h.click(p, 'Enable');
    assert.equal(c.layers[17].parade.property(1).enabled, true);
});

test('direct Add Effect targets a layer without effects and lets host incompatibility fail safely', () => {
    const h = ui(),
        c = h.comp(),
        l = c.addLayer(),
        p = h.start();
    h.scan(p);
    const view = h.all(p, 'dropdownlist')[1];
    view.selection = 6;
    view.onChange();
    const tree = h.results(p),
        layerItem = tree.items[0].items[0].items[0];
    h.pick(p, layerItem);
    h.dialogHooks['Choose effect to apply'] = (d) => {
        h.all(d, 'listbox')[0].selection = 1;
        h.click(d, 'Choose');
    };
    h.click(p, 'Add Effect...');
    assert.equal(l.parade.property(1).matchName, 'ADBE Slider Control');
    h.drain(p);
    l.incompatible = true;
    h.click(p, 'Add Effect...');
    assert.equal(l.parade.numProperties, 1);
    assert.equal(p.fxController.batch.lastReport.failedBeforeWrite, 1);
    assert.equal(p.fxController.batch.lastReport.unknown, 0);
});

test('individual paging and Select Results respect a new pending query without acting on hidden selections', () => {
    const h = ui(),
        c = h.comp();
    for (let i = 0; i < 500; i++)
        c.addLayer(h.AVLayer, 'Layer ' + i).parade.addProperty('ADBE Glo2');
    const p = h.start();
    h.scan(p);
    const tree = h.results(p),
        q = h.all(p, 'edittext')[0];
    assert.equal(tree.items.length, 200);
    h.adapter.capture = () => {
        throw Error('selection/navigation must not capture');
    };
    h.click(p, 'Select Results');
    assert.equal(p.fxController.selected().instances.length, 500);
    h.click(p, 'Next');
    assert.equal(tree.items.length, 200);
    q.text = 'Layer 499';
    q.onChanging();
    h.click(p, 'Select Results');
    assert.equal(tree.items.length, 1);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(p.fxController.selected().instances[0].layerName, 'Layer 499');
    h.click(p, 'Disable');
    assert.equal(c.layers[499].parade.property(1).enabled, false);
    assert.ok(
        c.layers.slice(0, 499).every((l) => l.parade.property(1).enabled)
    );
});

test('change plus click notifications preserve additive selection, while a new click after Select Results replaces it', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p);
    h.pick(p, tree.items[0]);
    tree.control.listener_click({});
    h.more(p, 'Add to Selection');
    h.pick(p, tree.items[1]);
    tree.control.listener_click({});
    assert.equal(p.fxController.selected().instances.length, 2);
    h.click(p, 'Select Results');
    assert.equal(p.fxController.selected().instances.length, 18);
    tree.control.listener_mousedown({});
    tree.control.listener_click({});
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(p.fxController.selected().instances[0].layerName, 'Text 1');
});
