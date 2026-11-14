const test = require('node:test'),
    assert = require('node:assert/strict');
const { ui } = require('./ui-harness.cjs');
const { load, plain } = require('./helpers.cjs');

test('first Search inventories the chosen scope and applies its query without parameter capture', () => {
    const h = ui();
    h.glow();
    const fixtureCalls = h.calls.length;
    const p = h.start();
    const q = h.all(p, 'edittext')[0];
    q.text = 'Text';
    q.onChanging();
    h.adapter.capture = h.adapter.inventory = () => {
        throw Error('Search must remain shallow');
    };
    h.click(p, 'Search');
    h.drain(p);
    assert.equal(p.fxController.scanner.basic.instances.length, 18);
    assert.equal(h.results(p).items.length, 3);
    assert.ok(
        p.fxController.scanner
            .inventory()
            .instances.every((x) => !x.configuration)
    );
    h.pick(p, h.results(p).items[0]);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Edit Parameters...').enabled,
        true
    );
    assert.equal(
        h.calls
            .slice(fixtureCalls)
            .filter((c) => ['set', 'begin', 'remove', 'add'].includes(c[0]))
            .length,
        0
    );
});
test('repeated Search and Enter on a valid inventory give feedback and do not rescan', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.click(p, 'Search');
    h.drain(p);
    const sc = p.fxController.scanner,
        basic = sc.basic,
        q = h.all(p, 'edittext')[0];
    h.adapter.scanCursor = () => {
        throw Error('Unexpected rescan');
    };
    for (let i = 0; i < 3; i++) {
        h.click(p, 'Search');
        q.listener_keydown({ keyName: 'Enter' });
    }
    assert.equal(sc.basic, basic);
    assert.ok(
        h
            .all(p, 'statictext')
            .some((t) =>
                String(t.text).includes('18 effects / 18 layers match')
            )
    );
});
test('Search retries a failed scope and renews stale metadata without authorizing deep reads', () => {
    const h = ui();
    h.glow();
    const p = h.start(),
        prepare = h.adapter.scanCursor;
    h.adapter.scanCursor = () => {
        throw Error('Scope unavailable');
    };
    h.click(p, 'Search');
    assert.equal(p.fxController.scanner.job, null);
    assert.equal(
        h.all(p, 'button').find((b) => b.text === 'Search').enabled,
        true
    );
    h.adapter.scanCursor = prepare;
    h.click(p, 'Search');
    h.drain(p);
    const before = p.fxController.scanner.basic;
    p.fxController.scanner.invalidate();
    h.adapter.capture = () => {
        throw Error('No deep reads');
    };
    h.click(p, 'Search');
    h.drain(p);
    assert.notEqual(p.fxController.scanner.basic, before);
    assert.equal(p.fxController.scanner.basic.stale, false);
});
test('Search while work is queued cannot replace or overlap the job', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.click(p, 'Search');
    const job = p.fxController.scanner.job,
        button = h.all(p, 'button').find((b) => b.text === 'Search');
    assert.ok(job);
    assert.equal(button.enabled, false);
    button.onClick();
    assert.equal(p.fxController.scanner.job, job);
    h.drain(p);
    assert.equal(h.tasks.size, 0);
    assert.equal(button.enabled, true);
});
test('header uses an expanding spacer and a right aligned Help with version outside the header', () => {
    const h = ui(),
        p = h.start(),
        help = h.all(p, 'button').find((b) => b.text === 'Help');
    const header = help.parent;
    assert.deepEqual(Array.from(help.alignment), ['right', 'center']);
    assert.deepEqual(Array.from(header.children[1].alignment), [
        'fill',
        'center'
    ]);
    assert.equal(header.children.at(-1), help);
    assert.ok(!header.children.some((c) => /0\.1\./.test(String(c.text))));
    h.click(p, 'Help');
    assert.ok(
        h
            .all(h.windows.at(-1), 'statictext')
            .some(
                (t) =>
                    t.text ===
                    'FXHX ' + require('../package.json').version
            )
    );
    assert.equal(
        JSON.parse(p.fxController.diagnostics.text()).productVersion,
        require('../package.json').version
    );
});
test('viewport geometry fits large docks and exposes bounded overflow in short docks', () => {
    const { FX } = load();
    for (const width of [280, 320, 480, 800])
        for (const height of [120, 240, 400, 900]) {
            const m = plain(
                FX.Presentation.viewport(width, height, true, true, true)
            );
            assert.ok(m.treeHeight >= 100);
            assert.equal(m.maxScroll, Math.max(0, m.contentHeight - height));
            assert.equal(m.scrollbar, m.maxScroll > 0);
            assert.ok(m.width <= width);
            if (height === 900) assert.equal(m.scrollbar, false);
            if (height <= 240) assert.equal(m.scrollbar, true);
        }
    const widths = plain(FX.Presentation.rowWidths(333, [2, 1, 1], 4));
    assert.equal(widths.reduce((a, b) => a + b, 0) + 8, 333);
    assert.ok(widths[0] >= widths[1]);
});
test('scrollbar moves the clipped content and resizing clamps an obsolete scroll offset', () => {
    const h = ui(),
        p = h.start(),
        v = p.fxController.viewport,
        bar = h.all(p, 'scrollbar')[0];
    v.resize(280, 180);
    assert.equal(bar.visible, true);
    assert.ok(v.state().maxScroll > 0);
    bar.value = v.state().maxScroll;
    bar.onChanging();
    assert.equal(v.state().offset, v.state().maxScroll);
    assert.equal(p.fxController.content.bounds[1], -v.state().offset);
    v.resize(700, 1000);
    assert.equal(bar.visible, false);
    assert.equal(v.state().offset, 0);
    assert.equal(Math.abs(p.fxController.content.bounds[1]), 0);
});
test('wheel delivery scrolls controls without stealing the native results list wheel', () => {
    const h = ui(),
        p = h.start(),
        v = p.fxController.viewport,
        bar = h.all(p, 'scrollbar')[0],
        body = bar.parent;
    v.resize(280, 180);
    let prevented = 0;
    body.listener_wheel({
        target: body,
        deltaY: 48,
        preventDefault() {
            prevented++;
        }
    });
    assert.equal(v.state().offset, 48);
    assert.equal(prevented, 1);
    body.listener_wheel({
        target: h.results(p).control,
        deltaY: 48,
        preventDefault() {
            prevented++;
        }
    });
    assert.equal(v.state().offset, 48);
    assert.equal(prevented, 1);
    body.listener_mousewheel({ target: body, wheelDelta: 120 });
    assert.equal(v.state().offset, 0);
});
test('unsupported wheel events retain a usable scrollbar and keyboard fallback', () => {
    const h = ui({ unsupportedWheel: true }),
        p = h.start(),
        v = p.fxController.viewport;
    v.resize(280, 180);
    const bar = h.all(p, 'scrollbar')[0],
        body = bar.parent;
    body.listener_keydown({ keyName: 'PageDown', target: body });
    assert.ok(v.state().offset > 0);
    const before = v.state().offset;
    body.listener_keydown({
        keyName: 'PageUp',
        target: h.all(p, 'edittext')[0]
    });
    assert.equal(v.state().offset, before);
    h.click(p, 'Help');
    assert.equal(h.alerts.length, 0);
});
test('visible View is simple; optional groups can be enabled and cancelled without changing host data', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const controls = h.all(p, 'dropdownlist'),
        main = controls[1];
    assert.equal(controls.length, 2, 'only Scope and View; grouping mode is data');
    assert.equal(main.items.length, 3);
    h.adapter.capture = () => {
        throw Error('View must not analyze');
    };
    h.dialogHooks['Grouping'] = (d) => {
        h.all(d, 'dropdownlist')[0].selection = 2;
        h.click(d, 'Use view');
    };
    h.pick(p, h.results(p).items[0]);
    h.more(p, 'Grouping...');
    assert.equal(h.grouping(p).selection.index, 2);
    h.dialogHooks['Grouping'] = (d) => h.click(d, 'Cancel');
    h.more(p, 'Grouping...');
    assert.equal(main.selection.index, 1);
    main.selection = 0;
    main.onChange();
    assert.equal(h.results(p).items.length, 18);
    assert.equal(h.calls.filter((c) => c[0] === 'begin').length, 0);
});
test('unsafe advanced parameter grouping restores the prior usable view', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const main = h.all(p, 'dropdownlist')[1];
    h.dialogHooks['Grouping'] = (d) => {
        h.all(d, 'dropdownlist')[0].selection = 4;
        h.click(d, 'Use view');
    };
    h.pick(p, h.results(p).items[0]);
    h.more(p, 'Grouping...');
    assert.equal(h.grouping(p).selection.index, 7);
    assert.equal(main.selection.index, 0);
    assert.equal(h.results(p).items.length, 18);
});
test('report controls are reachable at the end of scrolling and closed controllers ignore retained callbacks', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const v = p.fxController.viewport;
    v.resize(280, 180);
    h.pick(p, h.results(p).items[0]);
    h.click(p, 'Disable');
    const report = h
        .all(p, 'statictext')
        .find((t) => String(t.text).startsWith('Updated 1 effects.'));
    assert.ok(report);
    v.scrollTo(v.state().maxScroll);
    assert.ok(report.bounds[3] - v.state().offset <= v.state().height);
    const offset = v.state().offset,
        bar = h.all(p, 'scrollbar')[0];
    p.close();
    bar.value = 0;
    bar.onChange();
    v.scrollTo(0);
    assert.equal(v.state().offset, offset);
});
