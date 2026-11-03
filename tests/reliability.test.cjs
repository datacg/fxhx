const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, plain } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');

test('error formatter handles real errors, hostile conversion and inaccessible host fields', () => {
    const { FX } = fixture();
    const error = new Error('original failure');
    error.line = 42;
    error.fileName = 'fixture.jsx';
    error.toString = () => {
        throw Error('conversion must not run');
    };
    const detail = plain(FX.U.errorInfo(error, 'search'));
    assert.equal(detail.message, 'original failure');
    assert.equal(detail.line, '42');
    assert.equal(detail.fileName, 'fixture.jsx');
    assert.equal(detail.operation, 'search');
    assert.match(detail.stack, /original failure/);
    const hostile = {};
    for (const field of ['message', 'line', 'fileName', 'stack', 'toString']) {
        Object.defineProperty(hostile, field, {
            get() {
                throw error;
            }
        });
    }
    assert.doesNotThrow(() => FX.U.errorText(hostile, 'host'));
    assert.match(FX.U.errorText(hostile, 'host'), /Uninspectable host error/);
    assert.doesNotThrow(() => FX.U.errorText(null, 'null'));
});

test('typing is deferred at every size; search errors and broken error sinks never escape', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    const sc = p.fxController.scanner,
        basic = sc.basic;
    const q = h.all(p, 'edittext')[0],
        tree = h.results(p);
    const count = p.fxController.diagnostics.metrics.$treeBuild.count;
    q.text = 'Text';
    q.onChanging();
    q.onChange();
    assert.equal(p.fxController.diagnostics.metrics.$treeBuild.count, count);
    const original = sc.inventory;
    sc.inventory = () => {
        throw Error('original typing exception');
    };
    assert.doesNotThrow(() => q.onChanging());
    assert.match(
        p.fxController.diagnostics.text(),
        /original typing exception/
    );
    p.fxController.diagnostics.error = () => {
        throw Error('broken sink');
    };
    for (const c of h.all(p, 'statictext')) {
        Object.defineProperty(c, 'text', {
            get: () => '',
            set() {
                throw Error('broken control');
            }
        });
    }
    assert.doesNotThrow(() => q.onChanging());
    assert.equal(sc.basic, basic);
    assert.equal(sc.basic.stale, false);
    assert.equal(h.alerts.length, 0);
    assert.ok(tree.items.length);
    sc.inventory = original;
});

test('Enter dispatch preserves event arguments and repeated search never rescans', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    const q = h.all(p, 'edittext')[0],
        basic = p.fxController.scanner.basic;
    h.adapter.scanCursor = () => {
        throw Error('search must not scan');
    };
    let prevented = 0;
    for (const text of ['Text', 'Text', '', 'missing', 'Glow']) {
        q.text = text;
        q.onChanging();
        q.listener_keydown({
            keyName: 'Enter',
            preventDefault() {
                prevented++;
            }
        });
    }
    assert.equal(prevented, 5);
    assert.equal(p.fxController.scanner.basic, basic);
    assert.equal(basic.stale, false);
    assert.equal(h.alerts.length, 0);
});

function editorFixture() {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    return { h, p };
}
function stage(h, d, value = '70') {
    const field = h.parameterFields(d)[0];
    field.text = value;
    field.onChanging();
    h.click(d, 'Apply');
}
test('editor and confirmation close before Batch; cancelled confirmation recovers the draft on explicit reopen', () => {
    const { h, p } = editorFixture();
    let editor;
    h.setConfirm(false);
    h.dialogHooks['Edit Parameters'] = (d) => {
        editor = d;
        stage(h, d);
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(editor.fxClosed, true);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    const execute = p.fxController.batch.execute;
    p.fxController.batch.execute = function (plan) {
        assert.ok(
            h.windows
                .filter((w) => w.type === 'dialog')
                .every((w) => w.fxClosed)
        );
        return execute.call(this, plan);
    };
    h.setConfirm(true);
    h.dialogHooks['Edit Parameters'] = (d) => {
        assert.equal(h.parameterFields(d)[0].text, '70');
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 18);
    assert.equal(p.fxController.scanner.basic.stale, true);
    const calls = h.calls.length;
    // A callback retained by ScriptUI must not operate on the old editor.
    h.click(editor, 'Apply');
    h.all(editor, 'edittext')[0].onChanging();
    assert.equal(h.calls.length, calls);
});
test('editor cancel, preview failure and open failure leave no writes or stranded dialogs', () => {
    const { h, p } = editorFixture();
    h.dialogHooks['Edit Parameters'] = (d) => h.click(d, 'Cancel');
    h.click(p, 'Edit Parameters...');
    p.fxController.batch.preview = () => {
        throw Error('preview failure');
    };
    h.dialogHooks['Edit Parameters'] = (d) => stage(h, d);
    h.click(p, 'Edit Parameters...');
    assert.match(p.fxController.diagnostics.text(), /preview failure/);
    assert.ok(h.windows.every((w) => w.type !== 'dialog' || w.fxClosed));
    const original = h.FX.Presentation.editRows;
    h.FX.Presentation.editRows = () => {
        throw Error('editor open failure');
    };
    h.click(p, 'Edit Parameters...');
    assert.match(p.fxController.diagnostics.text(), /editor open failure/);
    h.FX.Presentation.editRows = original;
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
});
test('closing panel inside an editor closes dialogs and suppresses callbacks', () => {
    const { h, p } = editorFixture();
    h.dialogHooks['Edit Parameters'] = (d) => {
        p.close();
        assert.equal(d.fxClosed, true);
        stage(h, d);
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    assert.equal(h.tasks.size, 0);
});

test('preference load and save errors remain inspectable without converting host errors', () => {
    for (const action of ['load', 'save']) {
        const h = ui({ grouped: true });
        h.glow();
        const error = new Error('preferences ' + action + ' failed');
        error.line = 123;
        error.toString = () => {
            throw Error('unsafe host conversion');
        };
        h.FX.Store = function () {};
        h.FX.Store.prototype.load = () => {
            if (action === 'load') throw error;
            return h.FX.Model.state();
        };
        h.FX.Store.prototype.save = () => {
            throw error;
        };
        const p = new h.Panel('panel');
        assert.doesNotThrow(() => h.FX.UI.start(p, { adapter: h.adapter }));
        if (action === 'save') {
            const group = h.all(p, 'dropdownlist')[1];
            group.selection = 1;
            group.onChange();
        }
        assert.match(
            p.fxController.diagnostics.text(),
            new RegExp('preferences ' + action + ' failed')
        );
        assert.match(p.fxController.diagnostics.text(), /123/);
        assert.equal(h.alerts.length, 0);
        assert.equal(p.fxController.scanner.basic, null);
    }
});

test('blocked all-selected edit writes nothing and a later reopen retains the draft without allowing partial consent', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    c.layers[0].parade.property(1).property(2).numKeys = 2;
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    h.setPartialConsent(false);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const list = h.all(d, 'listbox')[0];
        list.selection = 1;
        list.onChange();
        const field = h.parameterFields(d)[0];
        field.text = '100'; field.onChanging();
        assert.equal(h.all(d, 'button').find(b => b.text === 'Apply').enabled, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    assert.equal(p.fxController.scanner.basic.stale, false);
    h.setPartialConsent(true);
    h.dialogHooks['Edit Parameters'] = (d) => {
        assert.equal(h.all(d, 'listbox')[1].items.length, 1);
        assert.equal(h.parameterFields(d)[0].text, '100');
        assert.equal(h.all(d, 'button').find(b => b.text === 'Apply').enabled, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    assert.equal(c.layers[0].parade.property(1).property(2).value, 80);
    assert.equal(c.layers[0].parade.property(1).property(2).numKeys, 2);
});
