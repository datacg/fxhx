// Must precede every host read, file write, fixture and process-state change.
if (FX.HostTestOptIn !== true) {
    throw new Error(
        'Host integration tests are on hold. Explicit review/opt-in is required; no host operations were performed.'
    );
}
var outputName = '/ae-smoke-result.json';
if (FX.SmokeHeadless) {
    outputName = '/ae-smoke-headless-result.json';
}
var output = new File(FX.SmokeDirectory + outputName);
var results = {
    product: 'FX Exchanger',
    aeVersion: String(app.version),
    startedAt: new Date().toString(),
    passed: [],
    failed: [],
    pending: [
        'Real Window-menu docking and visual resize QA',
        'Manual native Undo',
        'Third-party effects'
    ],
    complete: false
};
var ownedComps = [],
    ownedSources = [],
    palette = null;
function flush() {
    output.encoding = 'UTF-8';
    if (!output.open('w')) {
        throw new Error(
            'Scripting file writes unavailable; no test will modify the project.'
        );
    }
    try {
        output.write(FX.JSON.stringify(results));
    } finally {
        output.close();
    }
}
function check(name, fn) {
    try {
        fn();
        results.passed.push(name);
    } catch (error) {
        results.failed.push({
            test: name,
            message: String(error),
            line: error.line || 0
        });
    }
    flush();
}
var adapter = new FX.AfterEffectsAdapter(new FX.Diagnostics()),
    scanner = new FX.Scanner(adapter),
    batch = new FX.Batch(adapter, scanner),
    glowPath = null;
function scan() {
    scanner.start('entire');
    var n = 10000;
    while (scanner.tick() && n-- > 0) {}
    FX.U.assert(n > 0, 'Scan timeout');
    scanner.analyze({});
    while (scanner.tick() && n-- > 0) {}
    FX.U.assert(n > 0, 'Analysis timeout');
    return scanner.current();
}
function glowRows(value) {
    return [
        {
            path: glowPath,
            valueType: 'OneD',
            value: value,
            name: 'Glow Intensity'
        }
    ];
}
try {
    flush();
    check(
        'final distributable parses in the native ExtendScript interpreter',
        function () {
            var bundleFile = new File(FX.BundlePath);
            bundleFile.encoding = 'UTF-8';
            FX.U.assert(bundleFile.open('r'), 'Cannot read built JSX');
            var bundle;
            try {
                bundle = bundleFile.read();
            } finally {
                bundleFile.close();
            }
            bundle = bundle.replace(/^\uFEFF/, '').replace(/^#.*$/gm, '');
            var compiled = new Function(bundle);
            FX.U.assert(
                typeof compiled === 'function',
                'Native JSX compilation failed'
            );
        }
    );
    FX.U.assert(
        app.project && app.project.numItems === 0 && app.project.file === null,
        'Requires an empty unsaved project; existing projects are never changed.'
    );
    var comp = app.project.items.addComp(
        '__FX_EXCHANGER_TEMP__',
        320,
        180,
        1,
        2,
        24
    );
    ownedComps.push(comp);
    var i, layer, parade, e, p, props;
    for (i = 0; i < 18; i++) {
        if (i < 3) {
            layer = comp.layers.addText('Text ' + i);
            layer.name = 'Text ' + i;
        } else {
            layer = comp.layers.addSolid(
                [0, 0, 0],
                'Adjustment ' + i,
                320,
                180,
                1,
                2
            );
            ownedSources.push(layer.source);
            layer.adjustmentLayer = true;
        }
        layer.label = 5;
        parade = layer.property('ADBE Effect Parade');
        e = parade.addProperty('ADBE Glo2');
        p = e.property('ADBE Glow-0004');
        if (!p) {
            for (var pi = 1; pi <= e.numProperties; pi++) {
                var candidate = e.property(pi);
                if (
                    String(candidate.name).toLowerCase().indexOf('intensity') >=
                    0
                ) {
                    p = candidate;
                    break;
                }
            }
        }
        FX.U.assert(p, 'Native Glow intensity property unavailable');
        glowPath = [{ matchName: String(p.matchName), index: p.propertyIndex }];
        if (i < 3) {
            p.setValue(50);
        } else if (i < 15) {
            p.setValue(6);
        } else {
            p.setValue(7);
        }
    }
    var empty = comp.layers.addNull();
    empty.name = 'Empty No Effects';
    check(
        'initial integration: scanner finds 18 native Glow and layer without effects',
        function () {
            var s = scan();
            FX.U.assert(
                s.instances.length === 18 && s.layers.length === 19,
                'Wrong inventory'
            );
            results.initialGroups = FX.Grouping.build(
                s.instances,
                'type-config'
            ).length;
            FX.U.assert(
                results.initialGroups === 3,
                'Expected three configuration groups'
            );
        }
    );
    if (!FX.SmokeHeadless) {
        check(
            'first ScriptUI integration: palette construction, scan, resize, cleanup',
            function () {
                palette = FX.UI.start(null, { noStorage: true });
                FX.U.assert(
                    palette.fxController && !palette.fxController.isPanel,
                    'Palette failed'
                );
                palette.size = [330, 760];
                palette.onResize();
                palette.fxController.scanner.start('entire');
                var count = 10000;
                while (palette.fxController.scanner.tick() && count-- > 0) {}
                palette.fxController.scanner.analyze({});
                while (palette.fxController.scanner.tick() && count-- > 0) {}
                FX.U.assert(
                    palette.fxController.scanner.result.instances.length === 18,
                    'UI scanner failed'
                );
                palette.fxController.dispose();
                palette.close();
                palette = null;
            }
        );
    } else {
        results.pending.push('ScriptUI palette (headless mode)');
    }
    check(
        'Glow acceptance: 3 Adjustment 7→6, then 15 Adjustment 6→4; Text 50 and other parameters preserved',
        function () {
            var s = scan(),
                before = {},
                j,
                x,
                target = [],
                report;
            for (j = 0; j < s.instances.length; j++) {
                x = s.instances[j];
                before['$' + FX.Model.effectKey(x)] = x.configuration;
                if (
                    x.layerType === 'Adjustment' &&
                    FX.Config.row(x.configuration, glowPath).value === 7
                ) {
                    target.push(x);
                }
            }
            FX.U.assert(target.length === 3, 'Wrong 7 group');
            report = batch.execute(
                batch.preview(target, 'set', { rows: glowRows(6) })
            );
            FX.U.assert(
                report.changed === 3 && report.failed === 0,
                '7→6 failed'
            );
            s = scan();
            var groups = FX.Grouping.build(s.instances, 'type-config');
            FX.U.assert(
                groups.length === 2,
                'Expected 15 Adjustment and 3 Text'
            );
            target = [];
            for (j = 0; j < s.instances.length; j++) {
                x = s.instances[j];
                if (x.layerType === 'Adjustment') {
                    FX.U.assert(
                        FX.Config.row(x.configuration, glowPath).value === 6,
                        'Adjustment not merged'
                    );
                    target.push(x);
                }
            }
            FX.U.assert(target.length === 15, 'Expected 15 Adjustment');
            report = batch.execute(
                batch.preview(target, 'set', { rows: glowRows(4) })
            );
            FX.U.assert(
                report.changed === 15 && report.failed === 0,
                '6→4 failed'
            );
            s = scan();
            for (j = 0; j < s.instances.length; j++) {
                x = s.instances[j];
                var old = before['$' + FX.Model.effectKey(x)];
                props = x.configuration.properties;
                for (var k = 0; k < props.length; k++) {
                    var prev = FX.Config.row(old, props[k].path);
                    if (
                        FX.Config.key(props[k].path) === FX.Config.key(glowPath)
                    ) {
                        var expected = 4;
                        if (x.layerType === 'Text') {
                            expected = 50;
                        }
                        FX.U.assert(
                            props[k].value === expected,
                            'Intensity incorrect'
                        );
                    } else {
                        FX.U.assert(
                            prev &&
                                FX.JSON.stringify(prev.value) ===
                                    FX.JSON.stringify(props[k].value),
                            'Unselected parameter changed'
                        );
                    }
                }
            }
        }
    );
    check(
        'native filters: label/type/name and layer with no effects',
        function () {
            var s = scan();
            FX.U.assert(
                FX.Filters.apply(s, {
                    type: 'Adjustment',
                    label: 5,
                    name: 'ADJUSTMENT'
                }).layers.length === 15,
                'Layer filters'
            );
            FX.U.assert(
                FX.Filters.apply(s, { effectMode: 'none' }).layers.length === 1,
                'Empty layer not found'
            );
        }
    );
    check(
        'native selected-parameters grouping and configuration differences',
        function () {
            var s = scan(),
                g = FX.Grouping.build(s.instances, 'selected', [glowPath]);
            FX.U.assert(g.length === 2, 'Selected grouping failed');
            var a = null,
                b = null;
            for (var j = 0; j < s.instances.length; j++) {
                if (s.instances[j].layerType === 'Text') {
                    a = s.instances[j];
                } else {
                    b = s.instances[j];
                }
            }
            var diff = FX.Config.diff(a.configuration, b.configuration, false);
            FX.U.assert(
                diff.length === 1 &&
                    FX.Config.key(diff[0].path) === FX.Config.key(glowPath),
                'Wrong diff'
            );
        }
    );
    check('native animation and disabled expression protection', function () {
        var t = adapter.resolve(scan().instances[0]),
            prop = t.effect.property(glowPath[0].index);
        prop.setValueAtTime(0, 3);
        prop.setValueAtTime(1, 5);
        var r = adapter.writeRows(t.effect, glowRows(9));
        FX.U.assert(prop.numKeys === 2 && r.skipped === 1, 'Animation changed');
        prop.removeKey(2);
        prop.removeKey(1);
        prop.expression = 'value*2';
        prop.expressionEnabled = false;
        r = adapter.writeRows(t.effect, glowRows(9));
        FX.U.assert(
            r.skipped === 1 && prop.expression.length > 0,
            'Disabled expression overwritten'
        );
        prop.expression = '';
    });
    check('native stale-stack revalidation before mutation', function () {
        var s = scan(),
            x = s.instances[0],
            plan = batch.preview([x], 'disable', {}),
            t = adapter.resolve(x);
        t.effect.name = 'Changed after scan';
        var refused = false;
        try {
            batch.execute(plan);
        } catch (error) {
            refused = true;
        }
        FX.U.assert(refused && t.effect.enabled, 'Stale target was mutated');
    });
    check(
        'native apply to empty layer; enable/disable/remove with one Undo group per operation',
        function () {
            var s = scan(),
                target = FX.Filters.apply(s, { effectMode: 'none' }).layers;
            FX.U.assert(target.length === 1, 'Empty target');
            var r = batch.execute(
                batch.preview(target, 'apply', {
                    matchName: 'ADBE Slider Control'
                })
            );
            FX.U.assert(r.changed === 1, 'Apply failed');
            s = scan();
            var effects = [];
            for (var j = 0; j < s.instances.length; j++) {
                if (s.instances[j].matchName === 'ADBE Slider Control') {
                    effects.push(s.instances[j]);
                }
            }
            r = batch.execute(batch.preview(effects, 'disable', {}));
            FX.U.assert(
                r.changed === 1 && !adapter.resolve(effects[0]).effect.enabled,
                'Disable failed'
            );
            s = scan();
            effects = [];
            for (j = 0; j < s.instances.length; j++) {
                if (s.instances[j].matchName === 'ADBE Slider Control') {
                    effects.push(s.instances[j]);
                }
            }
            r = batch.execute(batch.preview(effects, 'remove', {}));
            FX.U.assert(r.changed === 1, 'Remove failed');
        }
    );
    check('native Locate navigates and selects layer/effect', function () {
        var s = scan(),
            x = s.instances[0];
        adapter.locate(x);
        FX.U.assert(
            adapter.resolveLayer(x).layer.selected,
            'Locate did not select layer'
        );
    });
    check('native cancel invalidates partial work', function () {
        scanner.start('entire');
        scanner.cancel();
        FX.U.assert(!scanner.job && !scanner.result, 'Partial scan escaped');
    });
} catch (error) {
    results.failed.push({
        test: 'setup',
        message: String(error),
        line: error.line || 0
    });
} finally {
    if (palette) {
        try {
            palette.fxController.dispose();
            palette.close();
        } catch (closeError) {}
    }
    for (var ci = ownedComps.length - 1; ci >= 0; ci--) {
        try {
            ownedComps[ci].remove();
        } catch (cleanError) {
            results.failed.push({
                test: 'cleanup',
                message: String(cleanError)
            });
        }
    }
    for (var si = ownedSources.length - 1; si >= 0; si--) {
        try {
            if (ownedSources[si].usedIn.length === 0) {
                ownedSources[si].remove();
            }
        } catch (sourceError) {
            results.failed.push({
                test: 'cleanup-source',
                message: String(sourceError)
            });
        }
    }
    results.complete = true;
    try {
        flush();
    } catch (finalWriteError) {}
    // Process lifetime belongs to the user/launcher; the fixture never changes exit flags.
}
