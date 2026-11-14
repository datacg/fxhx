const test = require('node:test'),
    assert = require('node:assert/strict');
const { ui } = require('./ui-harness.cjs');

for (const behavior of [true, 'always']) {
    test(`programmatic dropdown notifications (${behavior}) cannot open startup dialogs or recurse`, () => {
        const h = ui({ selectionNotifications: behavior });
        const p = h.start();
        assert.ok(h.notifications.count >= (behavior === 'always' ? 1 : 0));
        assert.equal(h.notifications.overflow, 0);
        assert.ok(h.notifications.maxDepth <= 1);
        assert.equal(h.windows.length, 0);
        assert.equal(h.alerts.length, 0);
        assert.equal(h.tasks.size, 0);
        assert.equal(p.fxController.scanner.basic, null);
        assert.equal(p.fxController.scanner.job, null);
        assert.equal(h.grouping(p).selection.index, 7);
        assert.equal(h.all(p, 'dropdownlist')[1].selection.index, 0);
        assert.equal(h.calls.length, 0);
    });
}

test('restoring scope/preferences never invokes handlers that save or open work at startup', () => {
    const h = ui({ selectionNotifications: 'always' });
    const p = h.start();
    let saves = 0;
    const state = h.FX.Model.state();
    state.preferences.scope = 'entire';
    state.preferences.groupBy = 'selected';
    h.FX.Store = function () {};
    h.FX.Store.prototype.load = () => state;
    h.FX.Store.prototype.save = () => saves++;
    h.FX.UI.start(p, { adapter: h.adapter });
    assert.equal(h.all(p, 'dropdownlist')[0].selection.index, 2);
    assert.equal(state.preferences.scope, 'entire');
    assert.equal(saves, 0);
    assert.equal(h.windows.length, 0);
    assert.equal(h.alerts.length, 0);
    assert.equal(h.notifications.overflow, 0);
    assert.equal(h.tasks.size, 0);
});

test('View notifications switch Effects/Layers/groups without opening any modal or reading parameters', () => {
    const h = ui({ selectionNotifications: 'always' });
    h.glow();
    const p = h.start();
    h.scan(p);
    h.adapter.capture = () => {
        throw Error('View cannot analyze effects');
    };
    const view = h.all(p, 'dropdownlist')[1];
    const baselineCalls = h.calls.length;
    for (const index of [2, 0, 1, 2, 2, 0]) {
        view.selection = index;
        view.onChange(); // Also exercise duplicate/deferred notifications.
    }
    p.onResize();
    assert.equal(h.windows.length, 0);
    assert.equal(h.notifications.overflow, 0);
    assert.ok(h.notifications.maxDepth <= 2);
    assert.equal(h.alerts.length, 0);
    assert.equal(h.calls.length, baselineCalls);
    assert.equal(h.grouping(p).selection.index, 7);
});

for (const outcome of ['cancel', 'titlebar', 'use']) {
    test(`Grouping ${outcome} closes exactly once, including notifications delivered on close`, () => {
        const h = ui({ selectionNotifications: 'always' });
        h.glow();
        const p = h.start();
        h.scan(p);
        h.pick(p, h.results(p).items[0]);
        const main = h.all(p, 'dropdownlist')[1];
        let opened = 0;
        h.dialogHooks['Grouping'] = (d) => {
            opened++;
            assert.equal(opened, 1, 'Dialog must never reopen itself');
            const previousClose = d.onClose;
            d.onClose = () => {
                main.onChange();
                return previousClose();
            };
            if (outcome === 'titlebar') d.close(0);
            else h.click(d, outcome === 'use' ? 'Use view' : 'Cancel');
        };
        h.more(p, 'Grouping...');
        assert.equal(opened, 1);
        const d = h.windows.find((w) => w.text === 'Grouping');
        assert.equal(d.fxClosed, true);
        assert.equal(h.notifications.overflow, 0);
        assert.equal(h.alerts.length, 0);
        assert.equal(main.selection.index, outcome === 'use' ? 1 : 0);
        main.onChange();
        h.grouping(p).onChange();
        assert.equal(opened, 1);
        const q = h.all(p, 'edittext')[0];
        q.text = 'Text';
        q.onChanging();
        h.click(p, 'Search');
        assert.equal(p.fxController.scanner.job, null);
        p.close();
        assert.equal(h.tasks.size, 0);
        h.start();
        assert.equal(opened, 1);
    });
}

test('selected-parameter mode notifications never open a picker; explicit action is required', () => {
    const h = ui({ selectionNotifications: 'always' });
    h.glow();
    const p = h.start();
    h.scan(p);
    const hidden = h.grouping(p);
    hidden.selection = 4;
    hidden.onChange();
    assert.equal(h.windows.length, 0);
    assert.equal(hidden.selection.index, 7);
    assert.equal(h.all(p, 'dropdownlist')[1].selection.index, 0);
    assert.equal(h.alerts.length, 0);
    assert.equal(h.notifications.overflow, 0);
});
