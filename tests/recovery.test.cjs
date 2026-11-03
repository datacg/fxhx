const test = require('node:test'),
    assert = require('node:assert/strict');
const { fixture } = require('./helpers.cjs');
const { ui } = require('./ui-harness.cjs');

test('observer failures, including a broken observer error handler, cannot invalidate completed reads', () => {
    const h = fixture();
    h.glow();
    h.scanner.onProgress = () => {
        throw Error('progress display failed');
    };
    h.scanner.onDone = () => {
        throw Error('completion display failed');
    };
    h.scanner.onObserverError = () => {
        throw Error('error display failed');
    };
    h.scanner.start('entire');
    assert.doesNotThrow(() => {
        while (h.scanner.tick()) {}
    });
    assert.equal(h.scanner.current().instances.length, 18);
    assert.equal(h.scanner.basic.stale, false);
    assert.equal(h.scanner.ticking, false);
    assert.match(h.adapter.diagnostics.text(), /completion display failed/);
    h.scanner.analyze({});
    while (h.scanner.tick()) {}
    assert.equal(h.scanner.current().analysisState, 'analyzed');
    assert.equal(h.scanner.basic.stale, false);
});
test('failed scope preparation preserves scanner, tree and selection; retry starts normally', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p);
    h.pick(p, tree.items[0]);
    const basic = p.fxController.scanner.basic,
        first = tree.items[0];
    const count = p.fxController.selected().instances.length,
        prepare = h.adapter.scanCursor;
    h.adapter.scanCursor = () => {
        throw Error('scope temporarily unavailable');
    };
    assert.doesNotThrow(() => p.fxController.scan());
    assert.equal(p.fxController.scanner.basic, basic);
    assert.equal(basic.stale, false);
    assert.equal(tree.items[0], first);
    assert.equal(p.fxController.selected().instances.length, count);
    assert.match(
        p.fxController.diagnostics.text(),
        /scope temporarily unavailable/
    );
    h.adapter.scanCursor = prepare;
    h.scan(p);
    assert.notEqual(p.fxController.scanner.basic, basic);
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.equal(h.tasks.size, 0);
    // A failed start in a different project must not keep the previous project editable.
    h.app.project = { numItems: 0, items: [], activeItem: null };
    h.adapter.scanCursor = () => {
        throw Error('new project has no active composition');
    };
    p.fxController.scan();
    assert.equal(p.fxController.scanner.basic.stale, true);
    assert.ok(
        h.all(p, 'button').some((b) => b.text === 'Refresh' && b.enabled)
    );
});
test('failed native tree construction retains completed scanner and offers a local display retry', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start(),
        tree = h.results(p);
    const add = tree.add;
    tree.add = () => {
        throw Error('native tree construction failed');
    };
    h.scan(p);
    const sc = p.fxController.scanner,
        basic = sc.basic;
    assert.equal(sc.job, null);
    assert.equal(sc.ticking, false);
    assert.equal(sc.basic.stale, false);
    assert.equal(sc.current().instances.length, 18);
    assert.equal(h.tasks.size, 0);
    assert.equal(tree.control.enabled, false);
    assert.match(
        p.fxController.diagnostics.text(),
        /native tree construction failed/
    );
    tree.add = add;
    h.adapter.scanCursor = () => {
        throw Error('Retry display must not scan');
    };
    h.click(p, 'Retry display');
    assert.equal(sc.basic, basic);
    assert.equal(tree.control.enabled, true);
    assert.equal(tree.items.length, 1);
    assert.ok(p.fxController.diagnostics.metrics.$errorRecovery);
});
test('search render failure can be retried with the same query without discarding analysis', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p),
        add = tree.add,
        q = h.all(p, 'edittext')[0];
    tree.add = () => {
        throw Error('search tree failed');
    };
    q.text = 'Text';
    q.onChanging();
    q.listener_keydown({ keyName: 'Enter' });
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.equal(
        p.fxController.scanner
            .inventory()
            .instances.filter((x) => x.configuration).length,
        18
    );
    tree.add = add;
    q.listener_keydown({ keyName: 'Enter' });
    assert.equal(tree.control.enabled, true);
    assert.match(tree.items[0].text, /3 effects/);
});
test('old session callbacks and recursive callbacks cannot process the new job', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    p.fxController.scan();
    const code = h.tasks.get(p.fxController.scanner.task),
        match = /(\w+)\((\d+)\)/.exec(code);
    const savedCallback = h.$.global[match[1]],
        epoch = Number(match[2]);
    h.click(p, 'Cancel');
    p.fxController.scan();
    const job = p.fxController.scanner.job,
        cursor = job.cursor,
        index = cursor.layer;
    savedCallback(epoch);
    assert.equal(job.cursor, cursor);
    assert.equal(cursor.layer, index);
    const scanNext = h.adapter.scanNext;
    h.adapter.scanNext = function (...args) {
        p.fxController.scan(); // Must not replace a job while its tick is active.
        p.fxController.scanner.tick();
        return scanNext.apply(this, args);
    };
    h.drain(p);
    assert.equal(p.fxController.scanner.basic.instances.length, 18);
    assert.equal(h.tasks.size, 0);
    assert.equal(p.fxController.scanner.ticking, false);
});
test('render reentry and render requests inside critical dialogs never rebuild the tree', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    const grouping = h.FX.Grouping.build;
    let calls = 0;
    h.FX.Grouping.build = function (...args) {
        calls++;
        assert.equal(p.fxController.render(), false);
        return grouping(...args);
    };
    const q = h.all(p, 'edittext')[0];
    q.text = 'Text';
    q.onChanging();
    q.listener_keydown({ keyName: 'Enter' });
    assert.equal(calls, 1);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const count = p.fxController.diagnostics.metrics.$treeBuild.count;
        assert.equal(p.fxController.render(), false);
        assert.equal(
            p.fxController.diagnostics.metrics.$treeBuild.count,
            count
        );
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(p.fxController.scanner.basic.stale, false);
});
test('post-write presentation error keeps operation results and permits Results, Refresh and analysis', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    // Fail only the report label, after the real mock Batch has returned.
    const label = h.all(p, 'statictext').find((c) => c.visible === false);
    assert.ok(label);
    Object.defineProperty(label, 'text', {
        configurable: true,
        get: () => '',
        set() {
            throw Error('post-batch label failed');
        }
    });
    h.dialogHooks['Edit Parameters'] = (d) => {
        const field = h.parameterFields(d)[0];
        field.text = '70';
        field.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(p.fxController.batch.lastReport.verified, 18);
    assert.equal(p.fxController.scanner.basic.stale, true);
    assert.match(p.fxController.diagnostics.text(), /post-batch label failed/);
    h.click(p, 'Results...');
    const results = h.windows.find((w) => w.text === 'Operation results');
    assert.match(h.all(results, 'edittext')[0].text, /Written and Verified/);
    h.click(p, 'Refresh');
    h.drain(p);
    assert.equal(p.fxController.scanner.basic.stale, false);
    h.read(p);
    h.drain(p);
    assert.equal(p.fxController.scanner.inventory().analysisState, 'analyzed');
    assert.equal(h.tasks.size, 0);
});
test('host write error offers Refresh without retrying uncertain writes', () => {
    const h = ui({ grouped: true }),
        c = h.glow(),
        p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    let attempts = 0;
    c.layers[0].parade.property(1).property(1).setValue = () => {
        attempts++;
        throw Error('mock host write error');
    };
    h.dialogHooks['Edit Parameters'] = (d) => {
        const field = h.parameterFields(d)[0];
        field.text = '70';
        field.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    const report = p.fxController.batch.lastReport;
    assert.equal(report.unknown, 1);
    assert.equal(report.verified, 17);
    assert.equal(attempts, 1);
    h.click(p, 'Refresh');
    h.drain(p);
    assert.equal(attempts, 1);
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.equal(p.fxController.batch.executing, false);
    assert.equal(h.tasks.size, 0);
});

test('a task the host refuses to cancel becomes harmless after cancellation, reopening or disposal', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    p.fxController.scan();
    const task = p.fxController.scanner.task,
        code = h.tasks.get(task);
    h.adapter.cancelTask = () => {
        throw Error('host refused cancellation');
    };
    h.click(p, 'Cancel');
    assert.equal(p.fxController.scanner.task, null);
    assert.equal(p.fxController.scanner.job, null);
    assert.match(
        p.fxController.diagnostics.text(),
        /host refused cancellation/
    );
    h.FX.UI.start(p, { adapter: h.adapter, noStorage: true });
    h.tasks.delete(task); // Simulate eventual delivery by the host.
    const vm = require('node:vm');
    assert.doesNotThrow(() => vm.runInNewContext(code, h.$.global));
    assert.equal(p.fxController.scanner.basic, null);
    p.close();
    assert.doesNotThrow(() => vm.runInNewContext(code, h.$.global));
    assert.equal(Object.keys(h.$.global).length, 0);
});

test('UI failure between job creation and first tick cancels the logical job and releases busy state', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    const sc = p.fxController.scanner,
        inventory = sc.inventory,
        prepare = h.adapter.scanCursor;
    let failed = false;
    h.adapter.scanCursor = function (...args) {
        const cursor = prepare.apply(this, args);
        sc.inventory = function () {
            if (!failed) {
                failed = true;
                throw Error('before-first-tick UI failure');
            }
            return inventory.call(this);
        };
        return cursor;
    };
    p.fxController.scan();
    assert.equal(sc.job, null);
    assert.equal(sc.task, null);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Cancel').enabled,
        false
    );
    assert.ok(
        h.all(p, 'button').some((b) => b.text === 'Refresh' && b.enabled)
    );
    assert.match(
        p.fxController.diagnostics.text(),
        /before-first-tick UI failure/
    );
    h.scan(p);
    assert.equal(sc.basic.stale, false);
    assert.equal(sc.basic.instances.length, 18);
});

test('UI failure before Batch invocation releases busy state without writing or reporting cancellation', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    const status =
        h
            .all(p, 'statictext')
            .find((c) => String(c.text).includes('Edit compatible')) ||
        h.all(p, 'statictext').find((c) => c.preferredSize.height === 38);
    assert.ok(status);
    let text = status.text;
    Object.defineProperty(status, 'text', {
        get: () => text,
        set(v) {
            if (String(v).startsWith('Validating all targets'))
                throw Error('before-batch UI failure');
            text = v;
        }
    });
    h.dialogHooks['Edit Parameters'] = (d) => {
        const f = h.parameterFields(d)[0];
        f.text = '70';
        f.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    assert.equal(p.fxController.scanner.basic.stale, false);
    assert.match(p.fxController.diagnostics.text(), /before-batch UI failure/);
    assert.match(String(status.text), /Error - batch/);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Edit Parameters...').enabled,
        true
    );
    assert.equal(
        h.windows.filter((w) => w.type === 'dialog').every((w) => w.fxClosed),
        true
    );
});
