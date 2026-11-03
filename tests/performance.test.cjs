const test = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    path = require('node:path');
const { ui, nodes } = require('./ui-harness.cjs');
test('increasing mock projects keep native rows bounded, searches coalesced and technical timing available', () => {
    const results = [];
    for (const [comps, layers, effects] of [
        [1, 80, 2],
        [4, 150, 2],
        [8, 200, 2]
    ]) {
        const h = ui({ grouped: true });
        for (let ci = 0; ci < comps; ci++) {
            const c = h.comp('Comp ' + ci);
            for (let li = 0; li < layers; li++) {
                const l = c.addLayer(h.AVLayer, 'Layer ' + li);
                for (let ei = 0; ei < effects; ei++)
                    l.parade.addProperty(
                        ei % 2 ? 'ADBE Slider Control' : 'ADBE Glo2'
                    );
            }
        }
        const p = h.start(),
            scope = h.all(p, 'dropdownlist')[0];
        scope.selection = 2;
        scope.onChange();
        const before = performance.now();
        h.scan(p);
        const tree = h.results(p),
            nativeNodes = nodes(tree).length,
            metrics = p.fxController.diagnostics.metrics;
        assert.equal(
            p.fxController.scanner.basic.instances.length,
            comps * layers * effects
        );
        assert.ok(nativeNodes <= 1000);
        assert.equal(h.tasks.size, 0);
        assert.equal(h.alerts.length, 0);
        assert.ok(metrics.$basicScan);
        assert.ok(metrics.$scanStep);
        assert.ok(metrics.$treeBuild);
        const initial = metrics.$treeBuild.count,
            q = h.all(p, 'edittext')[0];
        for (const text of ['g', 'gl', 'glo', 'glow']) {
            q.text = text;
            q.onChanging();
        }
        {
            assert.equal(metrics.$treeBuild.count, initial);
            assert.ok(
                h
                    .all(p, 'statictext')
                    .some((x) => x.text.includes('Search pending'))
            );
            q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
        }
        const afterSearch = metrics.$treeBuild.count;
        q.onChange();
        if (q.listener_keydown)
            q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
        assert.equal(metrics.$treeBuild.count, afterSearch);
        assert.equal(p.fxController.scanner.basic.stale, false);
        assert.equal(
            metrics.$tasksScheduled.count,
            metrics.$tasksCancelled.count
        );
        results.push({
            compositions: comps,
            layers: comps * layers,
            effects: comps * layers * effects,
            nativeNodes,
            wallMs: Number((performance.now() - before).toFixed(2)),
            metrics: JSON.parse(JSON.stringify(metrics))
        });
        p.close();
        assert.equal(h.tasks.size, 0);
        assert.equal(Object.keys(h.$.global).length, 0);
    }
    const dir = path.resolve(__dirname, '../artifacts');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'performance-0.1.14.json'),
        JSON.stringify(
            {
                environment: 'Node mocks only; not After Effects timing',
                results
            },
            null,
            2
        )
    );
});
test('pagination preserves full group counts and explicitly reports targets beyond the displayed page', () => {
    const h = ui({ grouped: true }),
        c = h.comp();
    for (let i = 0; i < 500; i++) c.addLayer().parade.addProperty('ADBE Glo2');
    const p = h.start();
    h.scan(p);
    const tree = h.results(p);
    assert.match(tree.items[0].text, /500 effects/);
    assert.equal(nodes(tree).filter((x) => x.type === 'item').length, 200);
    h.pick(p, tree.items[0]);
    assert.equal(p.fxController.selected().instances.length, 500);
    assert.ok(
        h
            .all(p, 'statictext')
            .some((x) => x.text.includes('300 on other pages, included'))
    );
    h.click(p, 'Next');
    assert.equal(nodes(tree).filter((x) => x.type === 'item').length, 200);
    assert.equal(p.fxController.selected().instances.length, 500);
    h.click(p, 'Next');
    assert.equal(nodes(tree).filter((x) => x.type === 'item').length, 100);
    assert.equal(h.alerts.length, 0);
});
test('render cache avoids new fingerprints/host reads, retains expansion and restores the active occurrence', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p),
        leaf = nodes(tree).find(
            (x) =>
                x.type === 'item' &&
                x.fxData.instances[0].layerName === 'Text 0'
        );
    h.pick(p, leaf);
    const key = leaf.fxNodeKey;
    tree.items[0].expanded = false;
    h.FX.Config.fingerprint = () => {
        throw Error('Unexpected canonicalization');
    };
    h.adapter.capture =
        h.adapter.inventory =
        h.adapter.project =
            () => {
                throw Error('Unexpected host read');
            };
    const q = h.all(p, 'edittext')[0];
    q.text = 'Text';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    assert.equal(
        h.FX.Model.effectKey(tree.selection.fxData.instances[0]),
        h.FX.Model.effectKey(leaf.fxData.instances[0])
    );
    assert.equal(tree.items[0].expanded, false);
    q.text = '';
    q.onChanging();
    if (q.listener_keydown)
        q.listener_keydown({ keyName: 'Enter', preventDefault() {} });
    assert.equal(tree.selection.fxNodeKey, key);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(h.alerts.length, 0);
    assert.ok(p.fxController.diagnostics.metrics.$groupingReuse);
});
test('inventory view is reused until revision or invalidation and the cache never authorizes stale writes', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.scan(p);
    const sc = p.fxController.scanner,
        a = sc.inventory();
    assert.equal(sc.inventory(), a);
    h.pick(p, h.results(p).items[0]);
    p.fxController.analyze();
    h.drain(p);
    assert.notEqual(sc.inventory(), a);
    const b = sc.inventory();
    assert.equal(sc.inventory(), b);
    sc.invalidate();
    assert.equal(sc.inventory().stale, true);
    assert.throws(() => sc.current(), /fresh/);
});
test('many distinct analyzed configurations still create only a bounded page of native nodes', () => {
    const h = ui({ grouped: true }),
        c = h.comp();
    for (let i = 0; i < 450; i++)
        c
            .addLayer(h.AVLayer, 'Layer ' + i)
            .parade.addProperty('ADBE Glo2')
            .property(1).value = i;
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p);
    assert.ok(nodes(tree).length <= 1000);
    assert.equal(nodes(tree).filter((x) => x.fxGroup).length, 200);
    assert.equal(
        p.fxController.scanner
            .inventory()
            .instances.filter((x) => x.configuration).length,
        450
    );
    assert.equal(h.alerts.length, 0);
    const metrics = p.fxController.diagnostics.metrics;
    assert.equal(metrics.$fingerprint.count, 450);
    assert.ok(metrics.$occurrenceRead);
    assert.ok(metrics.$configurationAnalysis);
    assert.equal(h.tasks.size, 0);
});
