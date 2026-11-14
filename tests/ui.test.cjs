const test = require('node:test'),
    assert = require('node:assert/strict');
const { ui, nodes } = require('./ui-harness.cjs');
test('opening has no scan, host contact, task, or empty action dialog', () => {
    const h = ui({ grouped: true });
    h.glow();
    for (const fn of ['scanCursor', 'capture', 'inventory', 'schedule'])
        h.adapter[fn] = () => {
            throw Error(fn);
        };
    const p = h.start();
    assert.equal(h.tasks.size, 0);
    assert.equal(p.fxController.scanner.basic, null);
    assert.equal(
        h.all(p, 'button').find((x) => x.text === 'More...').enabled,
        false
    );
    assert.equal(h.alerts.length, 0);
    assert.ok(
        !h
            .all(p, 'button')
            .some(
                (x) =>
                    x.text === 'Edit / Actions' ||
                    x.text === 'Select highlighted'
            )
    );
});
test('Basic always stays shallow; one click prepares targets and Analyze becomes Edit immediately after analysis', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p);
    assert.ok(
        p.fxController.scanner.basic.instances.every((x) => !x.configuration)
    );
    assert.equal(
        h.all(p, 'button').find((x) => x.text === 'More...').enabled,
        false
    );
    h.pick(p, tree.items[0]);
    assert.equal(p.fxController.selected().instances.length, 18);
    h.read(p);
    h.drain(p);
    assert.ok(
        h
            .all(p, 'button')
            .some((x) => x.text === 'Edit Parameters...' && x.enabled)
    );
    assert.ok(!h.all(p, 'button').some((x) => x.text === 'Read Parameters'));
    assert.equal(h.alerts.length, 0);
});
test('direct editor applies one changed field with no Add Change or intermediate dialog and preserves other parameters', () => {
    const h = ui({ grouped: true }),
        c = h.glow(),
        p = h.start();
    h.analyzed(p);
    const tree = h.results(p);
    h.pick(
        p,
        nodes(tree).find(
            (x) =>
                x.fxGroup &&
                x.fxGroup.layerType === 'Adjustment' &&
                x.fxGroup.instances.length === 3
        )
    );
    h.dialogHooks['Edit Parameters'] = (d) => {
        assert.ok(!h.all(d, 'button').some((x) => x.text === 'Add Change'));
        const field = h.parameterFields(d)[0];
        assert.equal(field.text, '');
        field.text = '6';
        field.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 3);
    assert.equal(c.layers[0].parade.property(1).property(1).value, 50);
    assert.ok(
        c.layers.every((l) => l.parade.property(1).property(2).value === 80)
    );
    assert.equal(h.alerts.length, 0);
    assert.match(h.confirmations.at(-1), /Other parameters unchanged/);
    assert.ok(!h.windows.some((w) => w.text === 'Edit / Actions'));
    assert.ok(h.all(p, 'button').some((x) => x.text === 'Refresh'));
});
test('mixed fields start empty, only edited values become pending, cancellation writes nothing', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    h.dialogHooks['Edit Parameters'] = (d) => {
        assert.match(h.all(d, 'listbox')[0].items[0].text, /Mixed Values/);
        const input = h.parameterFields(d)[0];
        assert.equal(input.text, '');
        input.text = '4';
        input.onChanging();
        assert.equal(h.all(d, 'listbox')[1].items.length, 1);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    assert.equal(h.alerts.length, 0);
});
test('multiple parameter drafts survive switching rows and untouched rows never enter the plan', () => {
    const h = ui({ grouped: true }),
        c = h.glow(),
        p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const list = h.all(d, 'listbox')[0],
            f = h.parameterFields(d)[0];
        f.text = '5';
        f.onChanging();
        list.selection = 1;
        list.onChange();
        f.text = '90';
        f.onChanging();
        list.selection = 0;
        list.onChange();
        assert.equal(f.text, '5');
        assert.equal(h.all(d, 'listbox')[1].items.length, 2);
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.ok(
        c.layers.every(
            (l) =>
                l.parade.property(1).property(1).value === 5 &&
                l.parade.property(1).property(2).value === 90
        )
    );
    assert.equal(h.alerts.length, 0);
});
test('editor blocks partial writes and preserves every selected effect until key removal is authorized', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    c.layers[0].parade.property(1).property(2).numKeys = 2;
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const list = h.all(d, 'listbox')[0];
        list.selection = 1;
        list.onChange();
        const f = h.parameterFields(d)[0];
        f.text = '100';
        f.onChanging();
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.confirmations.length, 0);
    assert.equal(c.layers[0].parade.property(1).property(2).numKeys, 2);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
    assert.equal(h.alerts.length, 0);
});
test('click replaces selection; Add to Selection unions a second group and Clear removes visible and hidden keys', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p),
        groups = nodes(tree).filter((x) => x.fxGroup);
    h.pick(p, groups[0]);
    h.more(p, 'Add to Selection');
    h.pick(p, groups[1]);
    assert.equal(p.fxController.selected().instances.length, 15);
    h.pick(p, groups[2]);
    assert.equal(p.fxController.selected().instances.length, 3);
    const q = h.all(p, 'edittext')[0];
    q.text = 'Text';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    assert.equal(p.fxController.selected().instances.length, 0);
    q.text = '';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    assert.equal(p.fxController.selected().instances.length, 3);
    h.more(p, 'Clear Selection');
    assert.equal(p.fxController.selected().instances.length, 0);
});
test('incompatible effect types have contextual guidance and cannot open the parameter editor', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    c.layers[0].parade.addProperty('ADBE Slider Control');
    const p = h.start();
    h.scan(p);
    h.select(p);
    p.fxController.analyze();
    h.drain(p);
    assert.ok(
        !h
            .all(p, 'button')
            .some((x) => x.text === 'Edit Parameters...' && x.enabled)
    );
    assert.ok(
        h.all(p, 'statictext').some((x) => x.text.includes('different types'))
    );
});
test('empty layers offer explicit Apply Effect directly from More', () => {
    const h = ui({ grouped: true }),
        c = h.comp();
    c.addLayer();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p);
    h.pick(p, tree.items[0]);
    h.dialogHooks['Choose effect to apply'] = (d) => {
        h.all(d, 'listbox')[0].selection = 1;
        h.click(d, 'Choose');
    };
    h.click(p, 'Add Effect...');
    assert.equal(
        c.layers[0].parade.property(1).matchName,
        'ADBE Slider Control'
    );
    assert.equal(h.alerts.length, 0);
});
test('More closes before comparison; comparison copies only selected static differences', () => {
    const h = ui({ grouped: true }),
        c = h.glow(),
        p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    const execute = p.fxController.batch.execute;
    p.fxController.batch.execute = function (plan) {
        assert.ok(
            h.windows
                .filter((w) => w.type === 'dialog')
                .every((w) => w.fxClosed)
        );
        return execute.call(this, plan);
    };
    h.dialogHooks['Compare configurations'] = (d) => {
        assert.equal(
            h.windows.find((w) => w.text === 'More Actions').closeCode,
            1
        );
        const choices = h.all(d, 'dropdownlist');
        choices[0].selection = 1;
        choices[1].selection = 2;
        choices[1].onChange();
        const list = h.all(d, 'listbox')[0];
        assert.equal(list.items.length, 1);
        list.items[0].selected = true;
        h.click(d, 'Copy A \u2192 B');
    };
    h.more(p, 'Compare...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 3);
    assert.equal(c.layers[0].parade.property(1).property(1).value, 50);
    assert.equal(h.alerts.length, 0);
});
test('search and grouping never read host and retain analysis when returning to an effect', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const basic = p.fxController.scanner.basic;
    h.adapter.capture =
        h.adapter.inventory =
        h.adapter.project =
            () => {
                throw Error('Unexpected read');
            };
    const q = h.all(p, 'edittext')[0];
    for (const query of ['Text', 'ADBE Glo', 'missing', '', 'Glow']) {
        q.text = query;
        q.onChanging();
        if (q.listener_keydown)
            q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    }
    assert.equal(p.fxController.scanner.basic, basic);
    assert.equal(
        p.fxController.scanner
            .inventory()
            .instances.filter((x) => x.configuration).length,
        18
    );
    assert.equal(h.alerts.length, 0);
});
test('search during queued analysis cannot expand frozen targets', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    const q = h.all(p, 'edittext')[0];
    q.text = 'Text';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    h.pick(p, h.results(p).items[0]);
    const scanner = p.fxController.scanner;
    scanner.analyze({}, p.fxController.selected().instances);
    q.text = 'Color';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    while (scanner.tick()) {}
    assert.equal(scanner.result.instances.length, 3);
    assert.ok(scanner.result.instances.every((x) => x.layerType === 'Text'));
    assert.equal(scanner.basic.instances.length, 18);
});
test('cancel, scope change, reopen and saved callbacks leave no orphan work', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    p.fxController.scan();
    assert.ok(h.tasks.size);
    h.click(p, 'Cancel');
    assert.equal(h.tasks.size, 0);
    h.scan(p);
    const old = p.fxController,
        fn = h.$.global[Object.keys(h.$.global)[0]];
    h.FX.UI.start(p, { adapter: h.adapter, noStorage: true });
    fn();
    assert.notEqual(old, p.fxController);
    assert.equal(p.children.length, 1);
    p.close();
    fn();
    assert.equal(Object.keys(h.$.global).length, 0);
    assert.equal(h.tasks.size, 0);
});
test('compositions support hidden multiselection, duplicate IDs and replacement refusal', () => {
    const h = ui({ grouped: true });
    h.comp('Duplicate');
    h.comp('Duplicate');
    const p = h.start(),
        scope = h.all(p, 'dropdownlist')[0];
    scope.selection = 1;
    scope.onChange();
    h.dialogHooks['Choose compositions'] = (d) => {
        h.click(d, 'Select All');
        const list = h.all(d, 'listbox')[0];
        assert.ok(list.items.every((x) => x.text.includes('[ID ')));
        const q = h.all(d, 'edittext')[0];
        q.text = 'missing';
        q.onChanging();
        if (q.listener_keydown)
            q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
        q.text = '';
        q.onChanging();
        if (q.listener_keydown)
            q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
        assert.equal(list.items.filter((x) => x.selected).length, 2);
        h.click(d, 'Use selection');
    };
    h.click(p, 'Choose...');
    h.setConfirm(false);
    h.dialogHooks['Choose compositions'] = (d) => {
        const list = h.all(d, 'listbox')[0];
        h.click(d, 'Clear Selection');
        list.items[0].selected = true;
        h.click(d, 'Use selection');
        assert.equal(d.closeCode, undefined);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Choose...');
    h.scan(p);
    assert.match(h.confirmations.at(-1), /Replace the previous/);
    assert.equal(h.alerts.length, 0);
});
test('multi-composition operation selection and Locate use the chosen Timeline only', () => {
    const h = ui({ grouped: true }),
        a = h.comp('A'),
        b = h.comp('B');
    for (const c of [a, b]) c.addLayer().parade.addProperty('ADBE Glo2');
    const p = h.start(),
        scope = h.all(p, 'dropdownlist')[0];
    scope.selection = 2;
    scope.onChange();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    assert.equal(p.fxController.selected().layers.length, 2);
    const locations = [];
    h.adapter.selectLayers = (rows) => locations.push(rows);
    h.dialogHooks['Choose Timeline composition'] = (d) => {
        h.all(d, 'dropdownlist')[0].selection = 1;
        h.click(d, 'Locate');
    };
    h.click(p, 'Locate');
    assert.ok(locations[0].every((x) => x.compId === b.id));
    p.fxController.analyze();
    h.drain(p);
    h.dialogHooks['Edit Parameters'] = (d) => {
        const f = h.parameterFields(d)[0];
        f.text = '8';
        f.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 2);
    assert.equal(h.alerts.length, 0);
});
test('animation inspection remains explicit and property filter after Basic explains missing analysis', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    h.dialogHooks['Layer and effect filters'] = (d) => {
        h.click(d, 'Property value...');
    };
    h.click(p, 'Filters...');
    assert.match(p.fxController.diagnostics.text(), /Read Parameters first/);
    p.fxController.analyze();
    h.drain(p);
    h.pick(
        p,
        nodes(h.results(p)).find(
            (x) => x.type === 'item' && x.fxData.instances.length === 1
        )
    );
    let reads = 0;
    h.adapter.inspectAnimation = (record, paths) => {
        reads++;
        return [
            {
                path: paths[0],
                complete: true,
                data: { keys: [], state: 'Static', keyCount: 0 }
            }
        ];
    };
    h.dialogHooks['Animation Inspection'] = (d) => {
        assert.equal(reads, 0);
        h.all(d, 'listbox')[0].items[0].selected = true;
        h.click(d, 'Inspect Selected');
    };
    h.more(p, 'Inspect Animation...');
    assert.equal(reads, 1);
    assert.equal(h.alerts.length, 0);
});
test('offline Help and selected parameter grouping preserve existing capabilities', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    c.layers[3].parade.property(1).property(2).value = 120;
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    h.dialogHooks['Group by selected parameters'] = (d) => {
        h.all(d, 'listbox')[0].items[0].selected = true;
        h.click(d, 'Use selected');
    };
    h.dialogHooks['Grouping'] = (d) => {
        h.all(d, 'dropdownlist')[0].selection = 4;
        h.click(d, 'Use view');
    };
    h.more(p, 'Grouping...');
    assert.equal(
        nodes(h.results(p)).filter((x) => x.fxGroup).length,
        3
    );
    h.dialogHooks['FXHX Help'] = (d) => {
        assert.equal(h.all(d, 'edittext')[0].props.scrolling, true);
    };
    h.click(p, 'Help');
    assert.equal(h.alerts.length, 0);
});
test('default effect results omit redundant layer lists; Layers explicitly retains layers without effects', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    c.addLayer(h.AVLayer, 'Empty');
    const p = h.start();
    h.scan(p);
    let tree = h.results(p);
    assert.ok(!tree.items.some((x) => x.text.startsWith('Layers')));
    assert.match(tree.items[0].text, /18 effects/);
    const grouping = h.grouping(p);
    grouping.selection = 6;
    grouping.onChange();
    assert.match(tree.items[0].text, /Layers - 19/);
    h.pick(
        p,
        nodes(tree).find(
            (x) =>
                x.fxData.layers.some((l) => l.layerName === 'Empty') &&
                x.type === 'item'
        )
    );
    assert.equal(p.fxController.selected().instances.length, 0);
    assert.equal(p.fxController.selected().layers.length, 1);
});
test('no-result search disables all target actions and shows recovery guidance', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    const q = h.all(p, 'edittext')[0];
    q.text = 'missing';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    assert.equal(h.results(p).items.length, 0);
    assert.equal(
        h.all(p, 'button').find((x) => x.text === 'More...').enabled,
        false
    );
    assert.ok(
        h.all(p, 'statictext').some((x) => x.text.startsWith('No results'))
    );
});
test('empty installed inventory reports no effects before constructing an empty chooser', () => {
    const h = ui({ grouped: true });
    h.comp().addLayer();
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    h.adapter.inventory = () => [];
    h.click(p, 'Add Effect...');
    assert.match(p.fxController.diagnostics.text(), /No effects are available/);
    assert.ok(!h.windows.some((w) => w.text === 'Choose effect to apply'));
});
test('analyzed copy reference is reused and chooser closes before the parameter picker', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    h.setConfirm(false);
    h.adapter.capture = h.adapter.selectedEffect = () => {
        throw Error('Unexpected reference read');
    };
    h.dialogHooks['Choose copy reference'] = (d) => {
        h.all(d, 'listbox')[0].selection = 0;
        h.click(d, 'Use analyzed result');
    };
    h.dialogHooks['Copy selected static parameters'] = (d) => {
        assert.equal(
            h.windows.find((w) => w.text === 'Choose copy reference').closeCode,
            1
        );
        h.all(d, 'listbox')[0].items[0].selected = true;
        h.click(d, 'Use selected');
    };
    h.more(p, 'Copy From Another Effect...');
    assert.equal(h.alerts.length, 0);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 0);
});
test('animated-only effects expose the editor with fixed-value conversion disabled by default', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    for (const l of c.layers)
        for (const p of l.parade.property(1).children) p.numKeys = 2;
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    assert.ok(
        h
            .all(p, 'button')
            .some((x) => x.text === 'Edit Parameters...' && x.enabled)
    );
    h.dialogHooks['Edit Parameters'] = d => {
        assert.ok(h.all(d, 'checkbox')[0].enabled);
        assert.equal(h.all(d, 'checkbox')[0].value, false);
        assert.ok(h.parameterFields(d).every(f => !f.enabled));
        assert.equal(h.all(d, 'button').find(b => b.fxTitle === 'Apply').enabled, false);
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    assert.equal(h.alerts.length, 0);
});
test('dialogs declare native keyboard default/cancel buttons and help exposes diagnostics with no selection', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    h.pick(p, h.results(p).items[0]);
    let editorOpened = false;
    h.dialogHooks['Edit Parameters'] = (d) => {
        editorOpened = true;
        // Enter in a value field must never submit the batch.
        assert.notEqual(
            h.all(d, 'button').find((x) => x.fxTitle === 'Apply').props.name,
            'ok'
        );
        assert.equal(
            h.all(d, 'button').find((x) => x.text === 'Cancel').props.name,
            'cancel'
        );
        h.click(d, 'Cancel');
    };
    h.click(p, 'Edit Parameters...');
    h.drain(p);
    assert.ok(editorOpened, 'the editor hook actually ran');
    h.more(p, 'Clear Selection');
    h.dialogHooks['FXHX Help'] = (d) => h.click(d, 'Diagnostics...');
    h.click(p, 'Help');
    assert.ok(h.windows.some((w) => w.text === 'FXHX diagnostics'));
    assert.equal(h.alerts.length, 0);
});
test('scope change during scan cancels work and cancelled analysis keeps inventory reusable', () => {
    const h = ui({ grouped: true });
    for (let i = 0; i < 4; i++) h.glow();
    const p = h.start();
    p.fxController.scan();
    const scope = h.all(p, 'dropdownlist')[0];
    scope.selection = 2;
    scope.onChange();
    assert.equal(h.tasks.size, 0);
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    p.fxController.analyze();
    assert.ok(p.fxController.scanner.job);
    h.click(p, 'Cancel');
    assert.equal(h.tasks.size, 0);
    assert.equal(p.fxController.scanner.basic.instances.length, 72);
    assert.ok(
        h.all(p, 'button').find((x) => x.text === 'Edit Parameters...').enabled
    );
    p.fxController.analyze();
    h.drain(p);
    assert.equal(
        p.fxController.scanner
            .inventory()
            .instances.filter((x) => x.configuration).length,
        72
    );
    assert.equal(h.alerts.length, 0);
});
test('post-edit refresh restores and rereads only affected unambiguous targets', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p);
    h.pick(
        p,
        nodes(tree).find(
            (x) =>
                x.fxGroup &&
                x.fxGroup.layerType === 'Adjustment' &&
                x.fxGroup.instances.length === 3
        )
    );
    h.dialogHooks['Edit Parameters'] = (d) => {
        const f = h.parameterFields(d)[0];
        f.text = '6';
        f.onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    let reads = 0;
    const capture = h.adapter.capture;
    h.adapter.capture = function (...args) {
        reads++;
        return capture.apply(this, args);
    };
    h.drain(p);
    assert.equal(reads, 3);
    assert.equal(p.fxController.selected().instances.length, 3);
    assert.ok(
        p.fxController.selected().instances.every((x) => !!x.configuration)
    );
    assert.ok(
        h
            .all(p, 'button')
            .some((x) => x.text === 'Edit Parameters...' && x.enabled)
    );
    assert.equal(h.alerts.length, 0);
});
test('Refresh never rebinds removed effects to new indices and preserves only identifiable layers', () => {
    const h = ui({ grouped: true }),
        c = h.comp(),
        l = c.addLayer();
    l.parade.addProperty('ADBE Glo2');
    l.parade.addProperty('ADBE Slider Control');
    const p = h.start();
    h.scan(p);
    h.pick(p, h.results(p).items[0]);
    h.more(p, 'Remove Effects');
    h.drain(p);
    assert.equal(p.fxController.selected().instances.length, 0);
    assert.equal(p.fxController.selected().layers.length, 1);
    assert.equal(l.parade.property(1).matchName, 'ADBE Slider Control');
    assert.equal(h.alerts.length, 0);
});
test('scheduler failures stop logical work and permit a new explicit scan', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start(),
        schedule = h.adapter.schedule;
    h.adapter.schedule = () => {
        throw Error('Scheduler unavailable');
    };
    p.fxController.scan();
    assert.equal(p.fxController.scanner.job, null);
    assert.equal(h.tasks.size, 0);
    assert.ok(h.all(p, 'statictext').some((x) => x.text.startsWith('Error')));
    h.adapter.schedule = schedule;
    h.scan(p);
    assert.equal(p.fxController.scanner.basic.instances.length, 18);
    assert.equal(h.tasks.size, 0);
});
test('animation filtering keeps Basic candidates selectable and discovers only explicitly requested animation', () => {
    const h = ui({ grouped: true }),
        c = h.glow();
    c.layers[0].parade.property(1).property(1).numKeys = 2;
    const p = h.start();
    h.scan(p);
    h.dialogHooks['Layer and effect filters'] = (d) => {
        const animation = h
            .all(d, 'dropdownlist')
            .find((x) => x.items.some((i) => i.text === 'Animated'));
        animation.selection = 2;
        h.click(d, 'Use filters');
    };
    h.click(p, 'Filters...');
    assert.match(h.results(p).items[0].text, /18 effects/);
    h.pick(p, h.results(p).items[0]);
    h.read(p);
    h.drain(p);
    assert.equal(p.fxController.scanner.result.instances.length, 1);
    assert.equal(
        p.fxController.scanner
            .inventory()
            .instances.filter((x) => x.configuration).length,
        18
    );
    h.dialogHooks['Layer and effect filters'] = (d) => h.click(d, 'Clear');
    h.click(p, 'Filters...');
    assert.equal(p.fxController.scanner.basic.instances.length, 18);
    assert.equal(h.alerts.length, 0);
});
test('complete Glow 18 direct UI workflow keeps Text and Radius through two selective edits', () => {
    const h = ui({ grouped: true }),
        c = h.glow(),
        p = h.start();
    h.analyzed(p);
    const tree = h.results(p);
    function edit(value) {
        h.dialogHooks['Edit Parameters'] = (d) => {
            const f = h.parameterFields(d)[0];
            f.text = String(value);
            f.onChanging();
            h.click(d, 'Apply');
        };
        h.click(p, 'Edit Parameters...');
    }
    h.pick(
        p,
        nodes(tree).find(
            (x) =>
                x.fxGroup &&
                x.fxGroup.layerType === 'Adjustment' &&
                x.fxGroup.instances.length === 3
        )
    );
    edit(6);
    h.drain(p);
    h.pick(p, tree.items[0]);
    h.read(p);
    h.drain(p);
    assert.deepEqual(
        nodes(tree)
            .filter((x) => x.fxGroup)
            .map((x) => x.fxGroup.instances.length)
            .sort((a, b) => a - b),
        [3, 15]
    );
    h.pick(
        p,
        nodes(tree).find(
            (x) => x.fxGroup && x.fxGroup.layerType === 'Adjustment'
        )
    );
    edit(4);
    for (const l of c.layers) {
        assert.equal(
            l.parade.property(1).property(1).value,
            l instanceof h.TextLayer ? 50 : 4
        );
        assert.equal(l.parade.property(1).property(2).value, 80);
    }
    assert.equal(h.alerts.length, 0);
    assert.equal(h.calls.filter((x) => x[0] === 'set').length, 18);
});
