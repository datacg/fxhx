FX.Config = (function () {
    function key(path) {
        return FX.JSON.stringify(path);
    }
    function row(config, path) {
        var i,
            k = key(path);
        if (!config) {
            return null;
        }
        for (i = 0; i < config.properties.length; i++) {
            if (key(config.properties[i].path) === k) {
                return config.properties[i];
            }
        }
        return null;
    }
    function state(config, path) {
        var i, k = key(path), states = config ? config.states || [] : [];
        for (i = 0; i < states.length; i++) {
            if (key(states[i].path) === k) {
                return states[i];
            }
        }
        return null;
    }
    function removable(state) {
        return !!state && state.state === 'Keyframed' &&
            state.expressionPresent === false &&
            (!state.control || state.control.kind !== 'unavailable-menu') &&
            typeof state.keyCount === 'number' && state.keyCount > 0 &&
            isFinite(state.keyCount) && state.keyCount === Math.floor(state.keyCount) &&
            FX.U.contains(['OneD', 'TwoD', 'ThreeD', 'TwoD_SPATIAL', 'ThreeD_SPATIAL', 'COLOR'], state.valueType);
    }
    function fingerprint(config, paths) {
        var props = [],
            unsupported = [],
            i,
            p,
            canonical,
            c;
        if (paths && paths.length) {
            for (i = 0; i < paths.length; i++) {
                p = row(config, paths[i]);
                if (p) {
                    props.push({
                        path: p.path,
                        valueType: p.valueType,
                        value: p.value
                    });
                    if (p.control && p.control.kind === 'menu') {
                        props[props.length - 1].menu = p.control.choices;
                    }
                } else {
                    unsupported.push({ path: paths[i], reason: 'unavailable' });
                }
            }
        } else {
            for (i = 0; i < config.properties.length; i++) {
                p = config.properties[i];
                props.push({
                    path: p.path,
                    valueType: p.valueType,
                    value: p.value
                });
                if (p.control && p.control.kind === 'menu') {
                    props[props.length - 1].menu = p.control.choices;
                }
            }
            unsupported = FX.U.clone(config.unsupported);
        }
        props.sort(function (a, b) {
            var x = key(a.path),
                y = key(b.path);
            if (x < y) {
                return -1;
            }
            if (x > y) {
                return 1;
            }
            return 0;
        });
        unsupported.sort(function (a, b) {
            var x = FX.JSON.stringify(a),
                y = FX.JSON.stringify(b);
            if (x < y) {
                return -1;
            }
            if (x > y) {
                return 1;
            }
            return 0;
        });
        c = {
            effectMatchName: config.effectMatchName,
            properties: props,
            unsupported: unsupported
        };
        if (!paths || !paths.length) {
            c.enabled = config.enabled;
        }
        canonical = FX.JSON.stringify(c);
        return {
            algorithm: 'static-v2',
            hash: FX.U.hash(canonical),
            canonical: canonical,
            complete: unsupported.length === 0,
            comparable: props.length,
            unsupported: unsupported.length
        };
    }
    function equal(a, b) {
        return (
            a.complete &&
            b.complete &&
            a.algorithm === b.algorithm &&
            a.canonical === b.canonical
        );
    }
    function readable(config, paths, existing) {
        var fp = existing || fingerprint(config, paths);
        if (fp.complete) {
            return {
                canonical: fp.canonical,
                hash: fp.hash,
                comparable: fp.comparable
            };
        }
        var data = FX.JSON.parse(fp.canonical);
        // Compare accessible settings separately. Unknowns must never become full equality.
        data.unsupported = [];
        var canonical = FX.JSON.stringify(data);
        return {
            canonical: canonical,
            hash: FX.U.hash(canonical),
            comparable: fp.comparable
        };
    }
    function diff(a, b, all) {
        var paths = {},
            out = [],
            i,
            k,
            x,
            y,
            names = [];
        function add(c) {
            var j, p;
            for (j = 0; j < c.properties.length; j++) {
                p = c.properties[j];
                k = key(p.path);
                if (!paths['$' + k]) {
                    paths['$' + k] = p.path;
                    names.push(k);
                }
            }
            for (j = 0; j < c.unsupported.length; j++) {
                p = c.unsupported[j];
                k = key(p.path);
                if (!paths['$' + k]) {
                    paths['$' + k] = p.path;
                    names.push(k);
                }
            }
        }
        add(a);
        add(b);
        names.sort();
        for (i = 0; i < names.length; i++) {
            k = names[i];
            x = row(a, paths['$' + k]);
            y = row(b, paths['$' + k]);
            var same =
                !!x &&
                !!y &&
                x.valueType === y.valueType &&
                FX.JSON.stringify(x.control && x.control.kind === 'menu' ? x.control.choices : null) ===
                    FX.JSON.stringify(y.control && y.control.kind === 'menu' ? y.control.choices : null) &&
                FX.JSON.stringify(x.value) === FX.JSON.stringify(y.value);
            if (all || !same) {
                out.push({
                    path: paths['$' + k],
                    name: (x || y || {}).name || k,
                    a: x,
                    b: y,
                    equal: same,
                    comparable: !!x && !!y && x.valueType === y.valueType &&
                        FX.JSON.stringify(x.control && x.control.kind === 'menu' ? x.control.choices : null) ===
                            FX.JSON.stringify(y.control && y.control.kind === 'menu' ? y.control.choices : null)
                });
            }
        }
        return out;
    }
    return {
        key: key,
        row: row,
        state: state,
        removable: removable,
        fingerprint: fingerprint,
        equal: equal,
        readable: readable,
        diff: diff
    };
})();
