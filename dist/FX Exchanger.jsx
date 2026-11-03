// FX Exchanger 0.1.15 — generated; edit src.
#target aftereffects
#targetengine "fxexchanger"
(function(host){
var FX={};
// MODULE: utils/util.js
FX.U = (function () {
    var counter = 0;
    // Never coerce a host Error object: ExtendScript conversion can itself throw.
    function errorInfo(error, operation) {
        var out = {
                message: 'Uninspectable host error',
                operation: '',
                line: '',
                fileName: '',
                stack: ''
            },
            fields = ['message', 'line', 'fileName', 'stack'],
            i,
            value;
        function primitive(v) {
            if (typeof v === 'string') {
                return v.slice(0, 4000);
            }
            if (typeof v === 'number' || typeof v === 'boolean') {
                return String(v);
            }
            return '';
        }
        try {
            out.operation = primitive(operation);
        } catch (ignoredOperation) {}
        try {
            value = primitive(error);
            if (value) {
                out.message = value;
            }
        } catch (ignoredValue) {}
        for (i = 0; i < fields.length; i++) {
            try {
                value = primitive(error[fields[i]]);
                if (value !== '') {
                    out[fields[i]] = value;
                }
            } catch (ignoredField) {}
        }
        return out;
    }
    function errorText(error, operation) {
        var e = errorInfo(error, operation);
        return (
            e.message +
            ' [operation: ' +
            e.operation +
            '; line: ' +
            e.line +
            '; file: ' +
            e.fileName +
            ']'
        );
    }
    function own(o, k) {
        return Object.prototype.hasOwnProperty.call(o, k);
    }
    function array(v) {
        return Object.prototype.toString.call(v) === '[object Array]';
    }
    function contains(a, v) {
        var i;
        for (i = 0; i < a.length; i++) {
            if (a[i] === v) {
                return true;
            }
        }
        return false;
    }
    function find(a, id) {
        var i;
        for (i = 0; i < a.length; i++) {
            if (a[i].id === id) {
                return a[i];
            }
        }
        return null;
    }
    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, '');
    }
    function now() {
        return new Date().getTime();
    }
    function id(prefix) {
        counter++;
        return (
            prefix +
            '-' +
            now().toString(36) +
            '-' +
            counter.toString(36) +
            '-' +
            Math.floor(Math.random() * 16777216).toString(36)
        );
    }
    function clone(v) {
        return FX.JSON.parse(FX.JSON.stringify(v));
    }
    function assert(b, message) {
        if (!b) {
            throw new Error(message);
        }
    }
    function move(a, index, delta) {
        var target = index + delta,
            value;
        if (index < 0 || target < 0 || target >= a.length) {
            return;
        }
        value = a.splice(index, 1)[0];
        a.splice(target, 0, value);
    }
    function hash(s) {
        var h = 2166136261,
            i;
        for (i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        return ('00000000' + (h >>> 0).toString(16)).slice(-8);
    }
    return {
        measure: function (diagnostics, name, started, items) {
            try {
                diagnostics.measure(name, FX.U.now() - started, items);
            } catch (ignoredMetric) {}
        },
        errorInfo: errorInfo,
        errorText: errorText,
        own: own,
        array: array,
        contains: contains,
        find: find,
        trim: trim,
        now: now,
        id: id,
        clone: clone,
        assert: assert,
        move: move,
        hash: hash
    };
})();

// MODULE: core/json.js
// Strict JSON, no eval and no dependency on the host's optional JSON global.
FX.JSON = (function () {
    function quote(s) {
        return (
            '"' +
            s.replace(/["\\\x00-\x1f\u2028\u2029]/g, function (c) {
                var map = {
                    '"': '\\"',
                    '\\': '\\\\',
                    '\b': '\\b',
                    '\f': '\\f',
                    '\n': '\\n',
                    '\r': '\\r',
                    '\t': '\\t'
                };
                return FX.U.own(map, c)
                    ? map[c]
                    : '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
            }) +
            '"'
        );
    }
    function stringify(v, depth) {
        var i,
            k,
            keys = [],
            parts = [];
        depth = depth || 0;
        if (depth > 64) {
            throw new Error('JSON depth limit');
        }
        if (v === null) {
            return 'null';
        }
        if (typeof v === 'string') {
            return quote(v);
        }
        if (typeof v === 'number') {
            if (!isFinite(v)) {
                throw new Error('Non-finite JSON number');
            }
            return String(v === 0 ? 0 : v);
        }
        if (typeof v === 'boolean') {
            return v ? 'true' : 'false';
        }
        if (FX.U.array(v)) {
            for (i = 0; i < v.length; i++) {
                parts.push(stringify(v[i], depth + 1));
            }
            return '[' + parts.join(',') + ']';
        }
        if (typeof v === 'object') {
            for (k in v) {
                if (FX.U.own(v, k)) {
                    keys.push(k);
                }
            }
            keys.sort();
            for (i = 0; i < keys.length; i++) {
                k = keys[i];
                parts.push(quote(k) + ':' + stringify(v[k], depth + 1));
            }
            return '{' + parts.join(',') + '}';
        }
        throw new Error('Unsupported JSON value');
    }
    function parse(text) {
        var pos = 0,
            tokens = 0;
        FX.U.assert(
            typeof text === 'string' && text.length <= 8388608,
            'JSON size limit'
        );
        function ws() {
            while (/\s/.test(text.charAt(pos)) && pos < text.length) {
                if (!/[ \r\n\t]/.test(text.charAt(pos))) {
                    break;
                }
                pos++;
            }
        }
        function string() {
            var out = '',
                c,
                e,
                hex,
                escapes = {
                    '"': '"',
                    '\\': '\\',
                    '/': '/',
                    b: '\b',
                    f: '\f',
                    n: '\n',
                    r: '\r',
                    t: '\t'
                };
            pos++;
            while (pos < text.length) {
                c = text.charAt(pos++);
                if (c === '"') {
                    return out;
                }
                if (c === '\\') {
                    e = text.charAt(pos++);
                    if (e === 'u') {
                        hex = text.substr(pos, 4);
                        FX.U.assert(
                            /^[0-9a-fA-F]{4}$/.test(hex),
                            'Invalid unicode'
                        );
                        out += String.fromCharCode(parseInt(hex, 16));
                        pos += 4;
                    } else {
                        FX.U.assert(FX.U.own(escapes, e), 'Invalid escape');
                        out += escapes[e];
                    }
                } else {
                    FX.U.assert(
                        c.charCodeAt(0) >= 32,
                        'Control character in JSON'
                    );
                    out += c;
                }
            }
            throw new Error('Unterminated JSON string');
        }
        function value(depth) {
            var c, out, key, m;
            tokens++;
            FX.U.assert(
                depth <= 64 && tokens <= 300000,
                'JSON complexity limit'
            );
            ws();
            c = text.charAt(pos);
            if (c === '"') {
                return string();
            }
            if (c === '{') {
                out = {};
                pos++;
                ws();
                if (text.charAt(pos) === '}') {
                    pos++;
                    return out;
                }
                while (true) {
                    ws();
                    FX.U.assert(
                        text.charAt(pos) === '"',
                        'JSON object key required'
                    );
                    key = string();
                    FX.U.assert(
                        key !== '__proto__' &&
                            key !== 'constructor' &&
                            key !== 'prototype' &&
                            !FX.U.own(out, key),
                        'Unsafe or duplicate JSON key'
                    );
                    ws();
                    FX.U.assert(
                        text.charAt(pos++) === ':',
                        'JSON colon required'
                    );
                    out[key] = value(depth + 1);
                    ws();
                    c = text.charAt(pos++);
                    if (c === '}') {
                        return out;
                    }
                    FX.U.assert(c === ',', 'JSON comma required');
                }
            }
            if (c === '[') {
                out = [];
                pos++;
                ws();
                if (text.charAt(pos) === ']') {
                    pos++;
                    return out;
                }
                while (true) {
                    FX.U.assert(out.length < 50000, 'JSON array limit');
                    out.push(value(depth + 1));
                    ws();
                    c = text.charAt(pos++);
                    if (c === ']') {
                        return out;
                    }
                    FX.U.assert(c === ',', 'JSON comma required');
                }
            }
            if (text.substr(pos, 4) === 'true') {
                pos += 4;
                return true;
            }
            if (text.substr(pos, 5) === 'false') {
                pos += 5;
                return false;
            }
            if (text.substr(pos, 4) === 'null') {
                pos += 4;
                return null;
            }
            m = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(
                text.substr(pos)
            );
            FX.U.assert(m !== null, 'Invalid JSON token');
            pos += m[0].length;
            out = Number(m[0]);
            FX.U.assert(isFinite(out), 'JSON numeric overflow');
            return out;
        }
        var result = value(0);
        ws();
        FX.U.assert(pos === text.length, 'Trailing JSON content');
        return result;
    }
    return { parse: parse, stringify: stringify };
})();

// MODULE: core/model.js
FX.Model = {
    state: function () {
        return {
            schemaVersion: 2,
            product: 'FX Exchanger',
            preferences: { scope: 'active', groupBy: 'type' }
        };
    },
    migrate: function (state) {
        FX.Validate.state(state);
        var s = FX.U.clone(state);
        if (s.schemaVersion === 1) {
            s.schemaVersion = 2;
            if (
                s.preferences.groupBy !== 'effect' &&
                s.preferences.groupBy !== 'type'
            ) {
                s.preferences.groupBy = 'type';
            }
        }
        if (
            s.preferences.scope === 'selected' ||
            s.preferences.scope === 'manual'
        ) {
            // Composition IDs are session-local; never restore an empty manual scope.
            s.preferences.scope = 'active';
        }
        return s;
    },
    layerKey: function (x) {
        var id = x.layerId;
        if (id === null || id === undefined) {
            id = 'index-' + x.layerIndex;
        }
        return x.compId + '/' + id;
    },
    effectKey: function (x) {
        return FX.Model.layerKey(x) + '/fx-' + x.effectIndex;
    }
};

// MODULE: core/validate.js
FX.Validate = (function () {
    function value(type, v) {
        var n = 0,
            i;
        if (type === 'OneD') {
            FX.U.assert(
                typeof v === 'number' && isFinite(v),
                'Finite number required'
            );
            return;
        }
        if (type === 'COLOR') {
            n = 4;
        } else if (type === 'TwoD' || type === 'TwoD_SPATIAL') {
            n = 2;
        } else if (type === 'ThreeD' || type === 'ThreeD_SPATIAL') {
            n = 3;
        }
        FX.U.assert(
            n > 0 && FX.U.array(v) && v.length === n,
            'Invalid value type or vector dimension'
        );
        for (i = 0; i < v.length; i++) {
            FX.U.assert(
                typeof v[i] === 'number' && isFinite(v[i]),
                'Finite vector required'
            );
        }
    }
    function rows(items) {
        var i,
            j,
            p,
            seen = {};
        FX.U.assert(
            FX.U.array(items) && items.length > 0,
            'Select parameters first'
        );
        for (i = 0; i < items.length; i++) {
            p = items[i];
            FX.U.assert(
                FX.U.array(p.path) && p.path.length > 0 && p.path.length <= 32,
                'Invalid path'
            );
            for (j = 0; j < p.path.length; j++) {
                FX.U.assert(
                    typeof p.path[j].matchName === 'string' &&
                        p.path[j].index >= 1 &&
                        p.path[j].index === Math.floor(p.path[j].index),
                    'Invalid path segment'
                );
            }
            var k = '$' + FX.Config.key(p.path);
            FX.U.assert(!seen[k], 'Duplicate property path');
            seen[k] = true;
            value(p.valueType, p.value);
            control(p.control);
            if (p.control && p.control.kind === 'menu') {
                FX.U.assert(p.valueType === 'OneD' && FX.Parameters.menuValue(p.control, p.value) !== null,
                    'Choose a valid dropdown option');
            }
            if (p.control && p.valueType === 'OneD') {
                FX.U.assert(p.control.min === undefined || p.value >= p.control.min, 'Value below minimum');
                FX.U.assert(p.control.max === undefined || p.value <= p.control.max, 'Value above maximum');
            }
        }
    }
    function control(c) {
        if (!c) {
            return;
        }
        FX.U.assert(c.kind === 'number' || c.kind === 'menu' || c.kind === 'unavailable-menu', 'Invalid control metadata');
        if (c.units !== undefined) {
            FX.U.assert(typeof c.units === 'string' && c.units.length <= 120, 'Invalid units');
        }
        var i, seen = {}, item;
        if (c.min !== undefined) { value('OneD', c.min); }
        if (c.max !== undefined) { value('OneD', c.max); }
        FX.U.assert(c.min === undefined || c.max === undefined || c.min <= c.max, 'Invalid control range');
        if (c.kind === 'menu') {
            FX.U.assert(FX.U.array(c.choices) && c.choices.length > 0 && c.choices.length <= 2048, 'Invalid menu choices');
            for (i = 0; i < c.choices.length; i++) {
                item = c.choices[i];
                FX.U.assert(item && typeof item.value === 'number' && isFinite(item.value) &&
                    item.value >= 1 && item.value === Math.floor(item.value) && !seen['$' + item.value] &&
                    typeof item.label === 'string' && item.label.length > 0 && item.label.length <= 512, 'Invalid menu option');
                seen['$' + item.value] = true;
            }
        }
    }
    function state(s) {
        FX.U.assert(
            s &&
                (s.schemaVersion === 1 || s.schemaVersion === 2) &&
                s.product === 'FX Exchanger',
            'Unsupported preferences format'
        );
        var k;
        for (k in s) {
            if (FX.U.own(s, k)) {
                FX.U.assert(
                    FX.U.contains(
                        ['schemaVersion', 'product', 'preferences'],
                        k
                    ),
                    'Unknown state field'
                );
            }
        }
        FX.U.assert(
            s.preferences &&
                FX.U.contains(
                    ['active', 'selected', 'manual', 'entire'],
                    s.preferences.scope
                ),
            'Invalid scope'
        );
        FX.U.assert(
            FX.U.contains(
                [
                    'effect',
                    'type',
                    'type-config',
                    'config',
                    'selected',
                    'composition'
                ],
                s.preferences.groupBy
            ),
            'Invalid grouping'
        );
        for (k in s.preferences) {
            if (FX.U.own(s.preferences, k)) {
                FX.U.assert(
                    FX.U.contains(['scope', 'groupBy'], k),
                    'Unknown preference'
                );
            }
        }
    }
    return { value: value, rows: rows, state: state, control: control };
})();

// MODULE: configurations/engine.js
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

// MODULE: configurations/animation.js
FX.Animation = (function () {
    function summary(config) {
        if (!config) {
            return 'Animation status not analyzed';
        }
        var states = config.states || [],
            kinds = {},
            i,
            unsupported = config.unsupported.length > 0;
        if (!states.length) {
            return 'Partial';
        }
        for (i = 0; i < states.length; i++) {
            kinds['$' + states[i].state] = true;
        }
        var parts = [];
        if (kinds.$Keyframed || kinds.$Mixed) {
            parts.push('Animated');
        }
        if (kinds['$Expression-driven'] || kinds.$Mixed) {
            parts.push('Expression');
        }
        if (kinds.$Unsupported || unsupported) {
            parts.push('Partial');
        }
        if (!parts.length && kinds.$Static) {
            return 'Static';
        }
        return parts.join(' / ') || 'Partial';
    }
    function matches(config, filter) {
        if (!filter || filter === 'Any') {
            return true;
        }
        if (!config) {
            return filter === 'Not Analyzed';
        }
        var label = summary(config);
        if (filter === 'Static') {
            return label === 'Static';
        }
        return label.indexOf(filter) >= 0;
    }
    function curve(key) {
        var a = key.inInterpolation,
            b = key.outInterpolation,
            ease,
            i,
            defaultEase = true;
        if (a === 'HOLD' || b === 'HOLD') {
            return 'Hold';
        }
        if (a === 'LINEAR' && b === 'LINEAR') {
            return 'Linear';
        }
        if (a !== 'BEZIER' || b !== 'BEZIER') {
            return 'Mixed / Unsupported';
        }
        if (!key.inEase || !key.outEase) {
            return 'Bezier (ease unavailable)';
        }
        ease = key.inEase.concat(key.outEase);
        for (i = 0; i < ease.length; i++) {
            if (
                Math.abs(ease[i].speed) > 0.000001 ||
                Math.abs(ease[i].influence - 33.333333) > 0.001
            ) {
                defaultEase = false;
            }
        }
        if (defaultEase && ease.length) {
            return 'Easy Ease-like (numeric pattern)';
        }
        return 'Bezier / Custom curve';
    }
    function compare(a, b) {
        if (
            a.valueType !== b.valueType ||
            FX.Config.key(a.path) !== FX.Config.key(b.path)
        ) {
            return { status: 'Not Comparable', equal: false };
        }
        // Captures contain only normalized supported fields. No hash-only equality.
        var same = FX.JSON.stringify(a.data) === FX.JSON.stringify(b.data);
        if (!same) {
            return { status: 'Different Animation Metadata', equal: false };
        }
        if (!a.complete || !b.complete) {
            return {
                status: 'Matching Readable Animation Metadata / Partial',
                equal: false
            };
        }
        return { status: 'Exact Supported Animation Metadata', equal: true };
    }
    return {
        summary: summary,
        matches: matches,
        curve: curve,
        compare: compare
    };
})();

// MODULE: configurations/parameters.js
// Eligibility is separate from numeric serialization. Host compositing controls
// and plugin bookkeeping are not user-facing effect adjustments.
FX.Parameters = (function () {
    function normalize(name) {
        return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    function profile(matchName, names) {
        var id = normalize(matchName), seen = {}, i;
        if (/^(?:(?:com)?(?:bskl|baskl))?aicolormatch(?:pro)?$/.test(id)) {
            return 'ai-color-match';
        }
        if (/^(?:pe|plugineverything)?deepglow2$/.test(id)) {
            return 'deep-glow-2';
        }
        // Version-independent fallback for the schema documented by the user.
        // Never identify an effect from its mutable instance display name.
        for (i = 0; names && i < names.length; i++) {
            seen['$' + normalize(names[i])] = true;
        }
        if (seen.$connectiontimestamp && seen.$colorstyleimage &&
            seen.$intensity && (seen.$stylereferenceimages || seen.$matchatplayhead)) {
            return 'ai-color-match';
        }
        if (seen.$glowmode && seen.$blendmode && seen.$thresholdsmooth && seen.$saturationbias) {
            return 'deep-glow-2';
        }
        return null;
    }
    function fromConfig(config) {
        if (!config) {
            return null;
        }
        if (config.parameterProfile) {
            return config.parameterProfile;
        }
        var names = [], i, sources = [config.properties || [], config.states || []], j;
        for (i = 0; i < sources.length; i++) {
            for (j = 0; j < sources[i].length; j++) {
                names.push(sources[i][j].name || '');
            }
        }
        return profile(config.effectMatchName, names);
    }
    function blocked(profileName, path, name, valueType) {
        var i, id, label = normalize(name);
        for (i = 0; path && i < path.length; i++) {
            id = path[i].matchName;
            if (id === 'ADBE Effect Built In Params' ||
                id === 'ADBE Effect Mask Opacity' ||
                id === 'ADBE Force CPU GPU' ||
                id === 'ADBE Effect Mask Parade') {
                return 'host-system-parameter';
            }
            id = normalize(id);
            if (id === 'connectiontimestamp' || id === 'gpurendering' || id === 'effectopacity' || id === 'debuganalysisenable') {
                return 'internal-parameter';
            }
        }
        if (label === 'connectiontimestamp' || label === 'gpurendering' || label === 'effectopacity' || label === 'debuganalysisenable') {
            return 'internal-parameter';
        }
        if (profileName === 'ai-color-match') {
            // The public numeric adjustment verified in the supplied UI is
            // Intensity. Buttons, reference inputs and private fields are not
            // candidates for generic numeric editing.
            if (label !== 'intensity' || path.length !== 1) {
                return 'not-public-parameter';
            }
            if (valueType && valueType !== 'OneD') {
                return 'profile-type-mismatch';
            }
        }
        return null;
    }
    function excluded(reason) {
        return reason === 'host-system-parameter' || reason === 'internal-parameter' ||
            reason === 'not-public-parameter' || reason === 'profile-type-mismatch';
    }
    function rows(matchName, rows) {
        var kept = [], i, current = profile(matchName, []);
        for (i = 0; i < rows.length; i++) {
            if (!blocked(current, rows[i].path, rows[i].name, rows[i].valueType)) {
                kept.push(rows[i]);
            }
        }
        return kept;
    }
    function choices(items) {
        var out = [], i, label;
        if (!FX.U.array(items) || items.length < 1 || items.length > 2048) {
            return null;
        }
        for (i = 0; i < items.length; i++) {
            label = items[i];
            if (typeof label !== 'string' || !label.length || label.length > 512) {
                return null;
            }
            if (label !== '(-') {
                out.push({ value: i + 1, label: label });
            }
        }
        return out.length ? out : null;
    }
    function menuValue(control, value) {
        var i;
        for (i = 0; control && control.choices && i < control.choices.length; i++) {
            if (control.choices[i].value === value) {
                return control.choices[i].label;
            }
        }
        return null;
    }
    function display(row, value) {
        if (typeof value === 'undefined') {
            value = row.value;
        }
        var label = menuValue(row.control, value);
        if (label !== null) {
            return label;
        }
        return FX.U.array(value) ? value.join(', ') : String(value);
    }
    return { profile: profile, fromConfig: fromConfig, blocked: blocked, excluded: excluded,
        rows: rows, choices: choices, menuValue: menuValue, display: display, normalize: normalize };
})();

// MODULE: filters/filters.js
FX.Filters = (function () {
    function text(value, query) {
        return (
            !query ||
            String(value).toLowerCase().indexOf(String(query).toLowerCase()) >=
                0
        );
    }
    function layer(l, f) {
        var flags = [
                'locked',
                'enabled',
                'shy',
                'threeD',
                'selected',
                'adjustment'
            ],
            i,
            k;
        if (!text(l.layerName, f.name) || !text(l.compName, f.compName)) {
            return false;
        }
        if (f.type && f.type !== 'Any' && l.layerType !== f.type) {
            return false;
        }
        if (f.label !== undefined && f.label !== null && l.label !== f.label) {
            return false;
        }
        for (i = 0; i < flags.length; i++) {
            k = flags[i];
            if (f[k] !== undefined && f[k] !== null && l[k] !== f[k]) {
                return false;
            }
        }
        if (f.effectMode === 'none' && l.effectCount !== 0) {
            return false;
        }
        if (f.effectMode === 'has' && l.effectCount === 0) {
            return false;
        }
        return true;
    }
    function basicEffect(e, f) {
        if (!text(e.effectName, f.effect) && !text(e.matchName, f.effect)) {
            return false;
        }
        if (
            f.effectEnabled !== undefined &&
            f.effectEnabled !== null &&
            e.enabled !== f.effectEnabled
        ) {
            return false;
        }
        return true;
    }
    function effect(e, f, includeUnanalyzedAnimation) {
        if (!basicEffect(e, f)) {
            return false;
        }
        if (
            !(includeUnanalyzedAnimation && !e.configuration) &&
            !FX.Animation.matches(e.configuration, f.animation)
        ) {
            return false;
        }
        var checks = f.properties || [],
            ci;
        if (f.property) {
            checks = checks.concat([f.property]);
        }
        for (ci = 0; ci < checks.length; ci++) {
            if (!e.configuration) {
                return false;
            }
            var check = checks[ci],
                p = FX.Config.row(e.configuration, check.path);
            if (
                !p ||
                p.valueType !== check.valueType ||
                FX.JSON.stringify(p.value) !== FX.JSON.stringify(check.value)
            ) {
                return false;
            }
        }
        return true;
    }
    function apply(scan, f, basicOnly, includeUnanalyzedAnimation) {
        var layers = [],
            instances = [],
            i,
            j,
            l,
            e,
            matched,
            needsEffect = !!(
                f.effect ||
                f.property ||
                (f.animation && f.animation !== 'Any') ||
                (f.properties && f.properties.length) ||
                f.effectMode === 'has' ||
                (f.effectEnabled !== undefined && f.effectEnabled !== null)
            );
        var byLayer = {};
        for (i = 0; i < scan.instances.length; i++) {
            e = scan.instances[i];
            var k = '$' + FX.Model.layerKey(e);
            if (!byLayer[k]) {
                byLayer[k] = [];
            }
            byLayer[k].push(e);
        }
        for (i = 0; i < scan.layers.length; i++) {
            l = scan.layers[i];
            if (!layer(l, f)) {
                continue;
            }
            matched = [];
            var items = byLayer['$' + FX.Model.layerKey(l)] || [];
            for (j = 0; j < items.length; j++) {
                if (
                    basicOnly
                        ? basicEffect(items[j], f)
                        : effect(items[j], f, includeUnanalyzedAnimation)
                ) {
                    matched.push(items[j]);
                }
            }
            if (needsEffect && !matched.length) {
                continue;
            }
            layers.push(l);
            for (j = 0; j < matched.length; j++) {
                instances.push(matched[j]);
            }
        }
        return { layers: layers, instances: instances };
    }
    function search(scan, query) {
        if (!query) {
            return scan;
        }
        var instances = [],
            layers = [],
            seen = {},
            i,
            e,
            l;
        for (i = 0; i < scan.instances.length; i++) {
            e = scan.instances[i];
            if (
                text(e.compName, query) ||
                text(e.layerName, query) ||
                text(e.effectName, query) ||
                text(e.matchName, query)
            ) {
                instances.push(e);
                seen['$' + FX.Model.layerKey(e)] = true;
            }
        }
        for (i = 0; i < scan.layers.length; i++) {
            l = scan.layers[i];
            if (
                seen['$' + FX.Model.layerKey(l)] ||
                text(l.compName, query) ||
                text(l.layerName, query)
            ) {
                layers.push(l);
            }
        }
        return { layers: layers, instances: instances };
    }
    return {
        search: search,
        apply: apply,
        layer: layer,
        effect: effect,
        basicEffect: basicEffect,
        text: text
    };
})();

// MODULE: grouping/grouping.js
FX.Grouping = (function () {
    function build(instances, mode, paths, snapshotFingerprints) {
        if (mode === 'selected') {
            FX.U.assert(
                paths && paths.length,
                'Choose grouping parameters first'
            );
        }
        var groups = [],
            buckets = {},
            i,
            j,
            e,
            fp,
            key,
            g,
            maxCounts = {},
            variations = {};
        for (i = 0; i < instances.length; i++) {
            e = instances[i];
            var compare = mode !== 'effect' && mode !== 'type';
            fp = e.fingerprint || {
                complete: false,
                hash: 'not-analyzed',
                canonical: '',
                comparable: 0,
                unsupported: 0
            };
            if (compare && e.configuration) {
                if (
                    !snapshotFingerprints ||
                    mode === 'selected' ||
                    !e.fingerprint
                ) {
                    fp = FX.Config.fingerprint(
                        e.configuration,
                        mode === 'selected' ? paths : null
                    );
                }
            }
            var readable = null;
            if (compare && e.configuration) {
                readable = FX.Config.readable(
                    e.configuration,
                    mode === 'selected' ? paths : null,
                    fp
                );
            }
            var variation = variations['$' + e.matchName];
            if (!variation) {
                variation = {};
                variations['$' + e.matchName] = variation;
            }
            for (
                j = 0;
                e.configuration && j < e.configuration.properties.length;
                j++
            ) {
                var p = e.configuration.properties[j],
                    pk = '$' + FX.Config.key(p.path),
                    pv = FX.JSON.stringify({
                        valueType: p.valueType,
                        value: p.value
                    });
                if (!variation[pk]) {
                    variation[pk] = { value: pv, different: false };
                } else if (variation[pk].value !== pv) {
                    variation[pk].different = true;
                }
            }
            key = '$' + e.matchName;
            if (
                mode === 'type' ||
                mode === 'type-config' ||
                mode === 'selected'
            ) {
                key += '/' + e.layerType;
            }
            if (mode === 'composition') {
                key += '/' + e.compId;
            }
            if (compare) {
                key += '/not-analyzed';
                if (readable) {
                    key += '/' + readable.hash;
                }
                if (readable && !readable.comparable) {
                    key += '/' + i;
                }
            }
            g = null;
            if (buckets[key]) {
                for (j = 0; j < buckets[key].length; j++) {
                    if (
                        !compare ||
                        (readable &&
                            buckets[key][j].readableFingerprint &&
                            readable.comparable > 0 &&
                            readable.canonical ===
                                buckets[key][j].readableFingerprint
                                    .canonical) ||
                        (!readable && !buckets[key][j].readableFingerprint)
                    ) {
                        g = buckets[key][j];
                        break;
                    }
                }
            }
            if (!g) {
                g = {
                    id: FX.U.id('group'),
                    matchName: e.matchName,
                    name: e.effectName,
                    layerType: e.layerType,
                    compName: e.compName,
                    fingerprint: fp,
                    readableFingerprint: readable,
                    complete: !!e.configuration && fp.complete,
                    analyzed: !!e.configuration,
                    instances: [],
                    mode: mode,
                    minority: false
                };
                groups.push(g);
                if (!buckets[key]) {
                    buckets[key] = [];
                }
                buckets[key].push(g);
            }
            g.instances.push(e);
            g.complete = g.complete && !!e.configuration && fp.complete;
        }
        function partition(group) {
            var parts = [group.matchName];
            if (mode === 'selected' || mode === 'type-config') {
                parts.push(group.layerType);
            }
            if (mode === 'composition') {
                parts.push(group.instances[0].compId);
            }
            return '$' + FX.JSON.stringify(parts);
        }
        var differencesByPartition = {},
            selectedPaths = {};
        if (mode === 'selected') {
            for (i = 0; i < paths.length; i++) {
                selectedPaths['$' + FX.Config.key(paths[i])] = true;
            }
        }
        function comparisonRows(group) {
            var config = group.instances[0].configuration,
                out = [],
                ri,
                p;
            if (!config) {
                return out;
            }
            if (mode !== 'selected') {
                out.push({ key: 'enabled', value: config.enabled });
            }
            for (ri = 0; ri < config.properties.length; ri++) {
                p = config.properties[ri];
                if (
                    mode === 'selected' &&
                    !selectedPaths['$' + FX.Config.key(p.path)]
                ) {
                    continue;
                }
                out.push({
                    key: FX.Config.key(p.path) + '/' + p.valueType,
                    value: p.value
                });
            }
            return out;
        }
        for (i = 0; i < groups.length; i++) {
            var partKey = partition(groups[i]),
                table = differencesByPartition[partKey] || {},
                comparisons = comparisonRows(groups[i]),
                ri,
                cell;
            differencesByPartition[partKey] = table;
            for (ri = 0; ri < comparisons.length; ri++) {
                cell = comparisons[ri];
                var value = FX.JSON.stringify(cell.value),
                    slot = '$' + cell.key;
                if (!table[slot]) {
                    table[slot] = { value: value, different: false };
                } else if (table[slot].value !== value) {
                    table[slot].different = true;
                }
            }
        }
        for (i = 0; i < groups.length; i++) {
            g = groups[i];
            key = partition(g);
            if (
                g.complete &&
                (!maxCounts[key] || g.instances.length > maxCounts[key])
            ) {
                maxCounts[key] = g.instances.length;
            }
        }
        for (i = 0; i < groups.length; i++) {
            g = groups[i];
            g.minority =
                compare &&
                g.complete &&
                g.instances.length < maxCounts[partition(g)];
            g.summary = [];
            var properties = [];
            if (g.instances[0].configuration) {
                properties = g.instances[0].configuration.properties;
            }
            for (j = 0; j < properties.length; j++) {
                var property = properties[j];
                if (mode === 'selected') {
                    var selected = false;
                    for (var pi = 0; pi < paths.length; pi++) {
                        if (
                            FX.Config.key(property.path) ===
                            FX.Config.key(paths[pi])
                        ) {
                            selected = true;
                            break;
                        }
                    }
                    if (!selected) {
                        continue;
                    }
                }
                if (
                    mode === 'selected' ||
                    variations['$' + g.matchName][
                        '$' + FX.Config.key(property.path)
                    ].different
                ) {
                    g.summary.push(property);
                }
            }
            g.matchStatus = 'Not Comparable';
            if (!g.analyzed) {
                g.matchStatus = 'Not Analyzed';
            } else if (g.complete && g.fingerprint.comparable > 0) {
                g.matchStatus = 'Exact Comparable Match';
            } else if (
                g.readableFingerprint &&
                g.readableFingerprint.comparable
            ) {
                g.matchStatus = 'Matching Readable Settings';
            }
            g.comparisonScope =
                mode === 'selected'
                    ? 'Selected parameters only'
                    : 'Readable configuration including enabled state';
            g.relationship = 'No concrete difference found';
            var compared = comparisonRows(g),
                partitionValues = differencesByPartition[partition(g)];
            for (j = 0; j < compared.length; j++) {
                if (partitionValues['$' + compared[j].key].different) {
                    g.relationship = 'Different Configurations';
                    break;
                }
            }
        }
        return groups;
    }
    return { build: build };
})();

// MODULE: diagnostics/report.js
FX.Diagnostics = function () {
    this.entries = [];
    this.metrics = {};
};
FX.Diagnostics.prototype.add = function (operation, matchName, code) {
    this.entries.push({
        date: FX.U.now(),
        operation: operation,
        matchName: matchName || '',
        code: code || 'operation-failed'
    });
    if (this.entries.length > 500) {
        this.entries.shift();
    }
};
FX.Diagnostics.prototype.text = function () {
    return FX.JSON.stringify({
        productVersion: FX.Updates.installed,
        entries: this.entries,
        metrics: this.metrics
    });
};
// Fixed technical metric names only; no project names, parameter values or vendor errors.
FX.Diagnostics.prototype.measure = function (name, milliseconds, items) {
    var key = '$' + name,
        m = this.metrics[key];
    if (!m) {
        m = { count: 0, totalMs: 0, maxMs: 0, lastMs: 0, items: 0 };
        this.metrics[key] = m;
    }
    m.count++;
    m.totalMs += milliseconds;
    m.lastMs = milliseconds;
    m.maxMs = Math.max(m.maxMs, milliseconds);
    m.items += items || 0;
};

// Error handling must remain usable even when a diagnostic sink fails.
FX.Diagnostics.prototype.error = function (operation, error) {
    var detail = FX.U.errorInfo(error, operation);
    try {
        this.add(operation, '', 'exception');
        this.entries[this.entries.length - 1].error = detail;
    } catch (ignoredDiagnostic) {}
    return detail;
};

// MODULE: updates/updates.js
// Release data is untrusted. Only numeric release versions and this repository
// are accepted; response contents are never executed or passed to the shell.
FX.Updates = (function () {
    var repository = 'https://github.com/datacg/fxhx',
        latest = repository + '/releases/latest',
        endpoint = 'https://api.github.com/repos/datacg/fxhx/releases/latest';
    function version(text) {
        FX.U.assert(typeof text === 'string' && /^v?(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/.test(text),
            'Invalid release version');
        var parts = text.replace(/^v/, '').split('.');
        return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    }
    function compare(a, b) {
        var x = version(a), y = version(b), i;
        for (i = 0; i < 3; i++) {
            if (x[i] > y[i]) { return 1; }
            if (x[i] < y[i]) { return -1; }
        }
        return 0;
    }
    function release(text, installed) {
        FX.U.assert(typeof text === 'string' && text.length <= 8192, 'Invalid update response');
        var data = FX.JSON.parse(text), tag = data.tag_name;
        version(tag);
        FX.U.assert(data.draft === false && data.prerelease === false, 'Release is not published/stable');
        FX.U.assert(data.html_url === repository + '/releases/tag/' + tag, 'Unexpected release URL');
        return { available: compare(tag, installed) > 0, version: tag.replace(/^v/, ''), url: data.html_url };
    }
    function checkCommand() {
        // This command contains fixed application strings only, with no user,
        // project, credential or remotely supplied arguments. No policy bypass.
        var script = "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';" +
            "try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" +
            "$r=Invoke-RestMethod -Uri '" + endpoint + "' -TimeoutSec 10 -MaximumRedirection 0 " +
            "-Headers @{Accept='application/vnd.github+json';'User-Agent'='FX-Exchanger';'X-GitHub-Api-Version'='2022-11-28'};" +
            "@{tag_name=[string]$r.tag_name;html_url=[string]$r.html_url;draft=[bool]$r.draft;prerelease=[bool]$r.prerelease}|ConvertTo-Json -Compress" +
            "}catch{if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404){'FXHX_NO_RELEASE'}else{'FXHX_UPDATE_ERROR'}}";
        return 'powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "' + script + '"';
    }
    function browserCommand() {
        return 'powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "Start-Process \'' + latest + '\'"';
    }
    return { installed: '0.1.15', repository: repository, latest: latest, endpoint: endpoint, version: version,
        compare: compare, release: release, checkCommand: checkCommand, browserCommand: browserCommand };
})();

// MODULE: storage/store.js
FX.Store = function (directory, options) {
    options = options || {};
    this.dir = directory || new Folder(Folder.userData.fsName + '/FXExchanger');
    this.baseName = options.baseName || 'state.json';
    FX.U.assert(
        /^[A-Za-z0-9-]+\.json$/.test(this.baseName),
        'Invalid store name'
    );
    this.validateDocument = options.validate || FX.Validate.state;
    this.defaultDocument = options.defaults || FX.Model.state;
    this.migrateDocument = options.migrate || FX.Model.migrate;
    this.lastRaw = null;
    this.recovered = false;
    this.recoverySource = null;
};
FX.Store.prototype.file = function (suffix) {
    return new File(this.dir.fsName + '/' + this.baseName + (suffix || ''));
};
FX.Store.prototype.readText = function (file) {
    FX.U.assert(file.exists, 'File not found');
    FX.U.assert(file.length <= 16777216, 'File size limit');
    file.encoding = 'UTF-8';
    FX.U.assert(file.open('r'), 'Cannot open file');
    var value;
    try {
        value = file.read();
        FX.U.assert(!file.error, 'File read failed');
    } finally {
        file.close();
    }
    return value.replace(/^\uFEFF/, '');
};
FX.Store.prototype.writeText = function (file, text) {
    file.encoding = 'UTF-8';
    FX.U.assert(file.open('w'), 'Cannot write file');
    try {
        FX.U.assert(file.write(text) && !file.error, 'File write failed');
    } finally {
        file.close();
    }
};
FX.Store.prototype.load = function () {
    var current = this.file(),
        candidate,
        s,
        i;
    this.lastRaw = current.exists ? this.readText(current) : null;
    if (this.lastRaw !== null) {
        try {
            s = FX.JSON.parse(this.lastRaw);
            this.validateDocument(s);
            return this.migrateDocument(s);
        } catch (error) {
            /* Try known backups; never silently reset. */
        }
    }
    for (i = 0; i <= 3; i++) {
        candidate = this.file(i === 0 ? '.rollback' : '.bak' + i);
        if (candidate.exists) {
            try {
                s = FX.JSON.parse(this.readText(candidate));
                this.validateDocument(s);
                this.recovered = true;
                this.recoverySource = candidate.fsName;
                return this.migrateDocument(s);
            } catch (error2) {}
        }
    }
    if (current.exists) {
        throw new Error(
            'State and backups are unreadable. Preserve the files and repair or move them before restarting.'
        );
    }
    return this.defaultDocument();
};
FX.Store.prototype.save = function (state) {
    this.validateDocument(state);
    FX.U.assert(
        this.dir.exists || this.dir.create(),
        'Cannot create storage folder'
    );
    var current = this.file(),
        actual = current.exists ? this.readText(current) : null,
        raw = FX.JSON.stringify(state),
        tmp = this.file('.tmp'),
        rollback = this.file('.rollback'),
        i,
        from,
        to;
    FX.U.assert(
        actual === this.lastRaw,
        'Storage changed in another panel/process. Reload before saving.'
    );
    this.writeText(tmp, raw);
    FX.U.assert(this.readText(tmp) === raw, 'Staging verification failed');
    if (current.exists) {
        if (this.recovered) {
            FX.U.assert(
                current.copy(this.file('.corrupt-' + FX.U.now()).fsName),
                'Cannot preserve corrupt state'
            );
        } else {
            for (i = 3; i >= 2; i--) {
                from = this.file('.bak' + (i - 1));
                to = this.file('.bak' + i);
                if (from.exists) {
                    FX.U.assert(from.copy(to.fsName), 'Backup rotation failed');
                }
            }
            FX.U.assert(
                current.copy(this.file('.bak1').fsName),
                'Backup failed'
            );
        }
        FX.U.assert(current.copy(rollback.fsName), 'Rollback copy failed');
        FX.U.assert(current.remove(), 'Cannot stage replacement');
    }
    if (!tmp.rename(this.baseName)) {
        if (rollback.exists) {
            rollback.copy(current.fsName);
        }
        throw new Error('Commit failed; previous state preserved in rollback');
    }
    this.lastRaw = raw;
    this.recovered = false;
    if (rollback.exists) {
        rollback.remove();
    }
};
FX.Store.prototype.backup = function () {
    var f = this.file();
    if (f.exists) {
        FX.U.assert(
            f.copy(this.file('.before-import-' + FX.U.now()).fsName),
            'Import backup failed'
        );
    }
};

// MODULE: storage/presets.js
// Data-only, single-effect static parameter presets. Never evaluates imported code.
FX.Presets = (function () {
    function empty() {
        return {
            schemaVersion: 1,
            product: 'FX Exchanger Presets',
            presets: []
        };
    }
    function fields(value, allowed) {
        var k;
        FX.U.assert(
            value && typeof value === 'object' && !FX.U.array(value),
            'Invalid preset object'
        );
        for (k in value) {
            if (FX.U.own(value, k)) {
                FX.U.assert(
                    FX.U.contains(allowed, k),
                    'Unknown preset field: ' + k
                );
            }
        }
    }
    function name(value) {
        FX.U.assert(typeof value === 'string', 'Name required');
        value = value.replace(/^\s+|\s+$/g, '');
        FX.U.assert(
            value.length > 0 &&
                value.length <= 120 &&
                !/[\x00-\x1f]/.test(value),
            'Use a name with 1 to 120 characters'
        );
        return value;
    }
    function validate(doc) {
        fields(doc, ['schemaVersion', 'product', 'presets']);
        FX.U.assert(
            doc.schemaVersion === 1 && doc.product === 'FX Exchanger Presets',
            'Unsupported preset library'
        );
        FX.U.assert(
            FX.U.array(doc.presets) && doc.presets.length <= 1000,
            'Preset limit: 1000'
        );
        var ids = {},
            names = {},
            i,
            j,
            p,
            r,
            k,
            segment;
        for (i = 0; i < doc.presets.length; i++) {
            p = doc.presets[i];
            fields(p, ['id', 'name', 'matchName', 'rows', 'omitted']);
            FX.U.assert(
                typeof p.id === 'string' &&
                    /^[A-Za-z0-9_-]{1,120}$/.test(p.id) &&
                    !ids['$' + p.id],
                'Invalid or duplicate preset ID'
            );
            ids['$' + p.id] = true;
            FX.U.assert(
                p.name === name(p.name) && !names['$' + p.name.toLowerCase()],
                'Invalid or duplicate preset name'
            );
            names['$' + p.name.toLowerCase()] = true;
            FX.U.assert(
                typeof p.matchName === 'string' &&
                    p.matchName.length > 0 &&
                    p.matchName.length <= 256,
                'Invalid effect identity'
            );
            FX.U.assert(
                typeof p.omitted === 'number' &&
                    p.omitted >= 0 &&
                    p.omitted === Math.floor(p.omitted),
                'Invalid omitted count'
            );
            FX.U.assert(
                FX.U.array(p.rows) && p.rows.length <= 4096,
                'Preset parameter limit'
            );
            FX.Validate.rows(p.rows);
            for (j = 0; j < p.rows.length; j++) {
                r = p.rows[j];
                fields(r, ['path', 'name', 'valueType', 'value', 'control']);
                if (r.control) {
                    fields(r.control, ['kind', 'choices', 'source', 'units', 'min', 'max']);
                    if (r.control.source !== undefined) {
                        FX.U.assert(r.control.source === 'host' || r.control.source === 'deep-glow-2', 'Invalid control source');
                    }
                    for (var ci = 0; r.control.choices && ci < r.control.choices.length; ci++) {
                        fields(r.control.choices[ci], ['value', 'label']);
                    }
                }
                FX.U.assert(
                    typeof r.name === 'string' && r.name.length <= 512,
                    'Invalid parameter name'
                );
                for (k = 0; k < r.path.length; k++) {
                    segment = r.path[k];
                    fields(segment, ['matchName', 'index']);
                    FX.U.assert(
                        segment.matchName.length > 0 &&
                            segment.matchName.length <= 256 &&
                            segment.index <= 65535,
                        'Invalid preset path identity'
                    );
                }
            }
        }
        return doc;
    }
    function Library(store) {
        this.store = store || null;
        this.document = validate(store ? store.load() : empty());
    }
    Library.prototype.list = function () {
        return FX.U.clone(this.document.presets);
    };
    Library.prototype.get = function (id) {
        var i;
        for (i = 0; i < this.document.presets.length; i++) {
            if (this.document.presets[i].id === id) {
                return FX.U.clone(this.document.presets[i]);
            }
        }
        throw new Error('Preset not found');
    };
    Library.prototype.commit = function (doc) {
        validate(doc);
        var copy = FX.U.clone(doc);
        if (this.store) {
            this.store.save(copy);
        }
        this.document = copy;
    };
    Library.prototype.save = function (title, matchName, rows, omitted, id) {
        var doc = FX.U.clone(this.document),
            i,
            found = -1;
        for (i = 0; id && i < doc.presets.length; i++) {
            if (doc.presets[i].id === id) {
                found = i;
            }
        }
        FX.U.assert(!id || found >= 0, 'Preset not found');
        var p = {
            id: id || FX.U.id('preset'),
            name: name(title),
            matchName: matchName,
            rows: FX.U.clone(rows),
            omitted: omitted || 0
        };
        if (found >= 0) {
            doc.presets[found] = p;
        } else {
            doc.presets.push(p);
        }
        this.commit(doc);
        return FX.U.clone(p);
    };
    Library.prototype.remove = function (id) {
        var doc = FX.U.clone(this.document),
            i,
            found = false;
        for (i = doc.presets.length - 1; i >= 0; i--) {
            if (doc.presets[i].id === id) {
                doc.presets.splice(i, 1);
                found = true;
            }
        }
        FX.U.assert(found, 'Preset not found');
        this.commit(doc);
    };
    Library.prototype.exportText = function () {
        return FX.JSON.stringify(this.document);
    };
    Library.prototype.importText = function (text) {
        FX.U.assert(
            typeof text === 'string' && text.length <= 16777216,
            'Import size limit'
        );
        var incoming = validate(FX.JSON.parse(text)),
            doc = FX.U.clone(this.document),
            byId = {},
            names = {},
            i,
            p,
            old,
            added = 0,
            skipped = 0;
        for (i = 0; i < doc.presets.length; i++) {
            p = doc.presets[i];
            byId['$' + p.id] = p;
            names['$' + p.name.toLowerCase()] = true;
        }
        for (i = 0; i < incoming.presets.length; i++) {
            p = incoming.presets[i];
            old = byId['$' + p.id];
            if (old) {
                FX.U.assert(
                    FX.JSON.stringify(old) === FX.JSON.stringify(p),
                    'Preset ID conflict: ' + p.name + '. No presets imported.'
                );
                skipped++;
                continue;
            }
            FX.U.assert(
                !names['$' + p.name.toLowerCase()],
                'Preset name conflict: ' +
                    p.name +
                    '. Rename before importing. No presets imported.'
            );
            doc.presets.push(p);
            byId['$' + p.id] = p;
            names['$' + p.name.toLowerCase()] = true;
            added++;
        }
        if (added) {
            this.commit(doc);
        }
        return { added: added, skipped: skipped };
    };
    function store(directory) {
        return new FX.Store(directory, {
            baseName: 'presets.json',
            validate: validate,
            defaults: empty,
            migrate: function (doc) {
                return doc;
            }
        });
    }
    return { empty: empty, validate: validate, Library: Library, store: store };
})();

// MODULE: ae/adapter.js
FX.AfterEffectsAdapter = function (diagnostics) {
    this.diagnostics = diagnostics;
};
FX.AfterEffectsAdapter.prototype.inventory = function () {
    var out = [],
        list = app.effects,
        i,
        e,
        seen = {};
    for (i = 0; i < list.length; i++) {
        try {
            e = list[i];
            if (!e.matchName || seen['$' + e.matchName]) {
                continue;
            }
            seen['$' + e.matchName] = true;
            out.push({
                matchName: String(e.matchName),
                displayName: String(e.displayName),
                category: String(e.category || ''),
                version: e.version ? String(e.version) : null
            });
        } catch (error) {
            this.diagnostics.add('inventory', '', 'read-error');
        }
    }
    out.sort(function (a, b) {
        var x = a.displayName.toLowerCase(),
            y = b.displayName.toLowerCase();
        if (x < y) {
            return -1;
        }
        if (x > y) {
            return 1;
        }
        return 0;
    });
    return out;
};
FX.AfterEffectsAdapter.prototype.version = function () {
    return String(app.version);
};
FX.AfterEffectsAdapter.prototype.checkForUpdates = function (installed) {
    FX.U.assert(typeof system !== 'undefined' && typeof system.callSystem === 'function',
        'Update checks are unavailable in this host. Open github.com/datacg/fxhx/releases.');
    var raw = String(system.callSystem(FX.Updates.checkCommand())).replace(/^\s+|\s+$/g, '');
    if (raw === 'FXHX_NO_RELEASE') { return { unpublished: true }; }
    FX.U.assert(raw !== 'FXHX_UPDATE_ERROR' && raw.length > 0,
        'Could not check GitHub. Check your connection or try again later.');
    return FX.Updates.release(raw, installed);
};
FX.AfterEffectsAdapter.prototype.openReleases = function () {
    FX.U.assert(typeof system !== 'undefined' && typeof system.callSystem === 'function',
        'Open github.com/datacg/fxhx/releases in your browser.');
    system.callSystem(FX.Updates.browserCommand());
};
FX.AfterEffectsAdapter.prototype.project = function () {
    return app.project;
};
FX.AfterEffectsAdapter.prototype.undo = function (label, fn) {
    app.beginUndoGroup('FX Exchanger - ' + label);
    try {
        return fn();
    } finally {
        app.endUndoGroup();
    }
};
FX.AfterEffectsAdapter.prototype.activeComp = function () {
    var comp = app.project.activeItem;
    FX.U.assert(comp instanceof CompItem, 'Open a composition first.');
    return comp;
};
FX.AfterEffectsAdapter.prototype.selectedLayers = function () {
    var layers = this.activeComp().selectedLayers;
    FX.U.assert(layers.length > 0, 'Select one or more layers.');
    return layers;
};
FX.AfterEffectsAdapter.prototype.selectedEffect = function () {
    var comp = this.activeComp(),
        props = comp.selectedProperties,
        out = [],
        i,
        p,
        j,
        found;
    for (i = 0; i < props.length; i++) {
        p = props[i];
        while (p && !p.isEffect) {
            p = p.parentProperty;
        }
        if (p) {
            found = false;
            for (j = 0; j < out.length; j++) {
                if (out[j] === p) {
                    found = true;
                }
            }
            if (!found) {
                out.push(p);
            }
        }
    }
    FX.U.assert(
        out.length === 1,
        'Select exactly one effect (or one of its properties) in Effect Controls.'
    );
    return out[0];
};
FX.AfterEffectsAdapter.prototype.valueType = function (prop) {
    var names = [
            'OneD',
            'TwoD',
            'ThreeD',
            'TwoD_SPATIAL',
            'ThreeD_SPATIAL',
            'COLOR'
        ],
        i,
        t = prop.propertyValueType;
    for (i = 0; i < names.length; i++) {
        if (t === PropertyValueType[names[i]]) {
            return names[i];
        }
    }
    if (t === PropertyValueType.CUSTOM_VALUE) {
        return 'custom';
    }
    if (
        t === PropertyValueType.LAYER_INDEX ||
        t === PropertyValueType.MASK_INDEX
    ) {
        return 'reference';
    }
    if (t === PropertyValueType.NO_VALUE) {
        return 'no-value';
    }
    return 'static-only';
};
FX.AfterEffectsAdapter.prototype._capture = function (effect, paths) {
    var self = this,
        out = {
            schemaVersion: 1,
            effectMatchName: String(effect.matchName),
            enabled: true,
            properties: [],
            unsupported: [],
            excluded: [],
            states: []
        },
        visited = 0,
        parameterProfile = this.parameterProfile(effect);
    out.parameterProfile = parameterProfile;
    try {
        out.enabled = effect.canSetEnabled ? !!effect.enabled : true;
    } catch (enabledError) {
        out.unsupported.push({
            path: [{ matchName: out.effectMatchName, index: 1 }],
            reason: 'read-error'
        });
    }
    function skip(path, reason, name) {
        if (reason === 'host-system-parameter' || reason === 'internal-parameter') {
            out.excluded.push({ path: path, reason: reason, name: name || '' });
            self.diagnostics.add('capture', out.effectMatchName, reason);
            return;
        }
        out.unsupported.push({ path: path, reason: reason });
        if (reason !== 'keyframed' && reason !== 'expression') {
            state(path, 'Unsupported', name || '', null, null, null);
        }
        self.diagnostics.add('capture', out.effectMatchName, reason);
    }
    function state(path, kind, name, keys, expression, expressionEnabled, valueType) {
        var item = {
                path: path,
                state: kind,
                name: name,
                keyCount: keys,
                expressionPresent: expression,
                expressionEnabled: expressionEnabled
            },
            i;
        if (valueType) {
            item.valueType = valueType;
        }
        for (i = 0; i < out.states.length; i++) {
            if (FX.Config.key(out.states[i].path) === FX.Config.key(path)) {
                out.states[i] = item;
                return;
            }
        }
        out.states.push(item);
    }
    function read(p, path) {
        var name = String(p.name || p.matchName),
            reason = FX.Parameters.blocked(parameterProfile, path, name),
            t,
            v,
            n,
            j,
            copy = [];
        if (reason) {
            skip(path, reason, name);
            return;
        }
        t = self.valueType(p);
        reason = FX.Parameters.blocked(parameterProfile, path, name, t);
        if (reason) {
            skip(path, reason, name);
            return;
        }
        if (
            !FX.U.contains(
                [
                    'OneD',
                    'TwoD',
                    'ThreeD',
                    'TwoD_SPATIAL',
                    'ThreeD_SPATIAL',
                    'COLOR'
                ],
                t
            )
        ) {
            skip(path, t, String(p.name || p.matchName));
            return;
        }
        var keys = p.numKeys,
            expression = '',
            expressionEnabled = null,
            kind = 'Static';
        if (
            typeof keys !== 'number' ||
            !isFinite(keys) ||
            keys < 0 ||
            keys !== Math.floor(keys)
        ) {
            skip(path, 'animation-unknown');
            return;
        }
        if (p.canSetExpression) {
            expression = String(p.expression || '');
        }
        if (expression.length) {
            kind = 'Expression-driven';
            try {
                expressionEnabled = !!p.expressionEnabled;
            } catch (expressionStateError) {
                self.diagnostics.add(
                    'capture',
                    out.effectMatchName,
                    'expression-state-unavailable'
                );
            }
        }
        if (keys > 0) {
            kind = expression.length ? 'Mixed' : 'Keyframed';
        }
        state(
            path,
            kind,
            String(p.name || p.matchName),
            keys,
            expression.length > 0,
            expressionEnabled,
            t
        );
        var control = self.parameterControl(effect, p, path, parameterProfile, t),
            capturedState = FX.Config.state(out, path);
        if (control && capturedState) {
            capturedState.control = control;
        }
        if (control && control.kind === 'unavailable-menu') {
            skip(path, 'menu-labels-unavailable', name);
            return;
        }
        if (keys > 0) {
            // A numeric snapshot is for review / clearing keys only. It never
            // makes a keyframed property a comparable static property.
            if (!expression.length) {
                try {
                    v = p.value;
                    FX.Validate.value(t, v);
                    if (!control || control.kind !== 'menu' || FX.Parameters.menuValue(control, v) !== null) {
                        capturedState.currentValue = FX.U.clone(v);
                    }
                } catch (snapshotError) {
                    self.diagnostics.add('capture', out.effectMatchName, 'keyframed-current-value-unavailable');
                }
            }
            skip(path, 'keyframed');
            return;
        }
        if (expression.length > 0) {
            skip(path, 'expression');
            return;
        }
        v = p.value;
        if (t === 'OneD') {
            if (typeof v !== 'number' || !isFinite(v)) {
                skip(path, 'read-error');
                return;
            }
        } else {
            if (t === 'COLOR') {
                n = 4;
            } else if (t === 'TwoD' || t === 'TwoD_SPATIAL') {
                n = 2;
            } else {
                n = 3;
            }
            if (!v || v.length !== n) {
                skip(path, 'read-error');
                return;
            }
            for (j = 0; j < v.length; j++) {
                if (typeof v[j] !== 'number' || !isFinite(v[j])) {
                    skip(path, 'read-error');
                    return;
                }
                copy.push(v[j]);
            }
            v = copy;
        }
        var captured = {
            path: path,
            valueType: t,
            value: v,
            name: String(p.name || p.matchName)
        };
        if (control) {
            captured.control = control;
        }
        if (control && control.kind === 'menu' && FX.Parameters.menuValue(control, v) === null) {
            skip(path, 'menu-value-unavailable', name);
            return;
        }
        out.properties.push(captured);
    }
    function walk(group, path, depth) {
        var i, p, next, reason;
        if (depth > 24) {
            skip(
                path.length
                    ? path
                    : [{ matchName: out.effectMatchName, index: 1 }],
                'limit'
            );
            return;
        }
        for (i = 1; i <= group.numProperties; i++) {
            next = path.concat([{ matchName: '', index: i }]);
            visited++;
            if (visited > 5000) {
                skip(next, 'limit');
                return;
            }
            try {
                p = group.property(i);
                next[next.length - 1].matchName = String(p.matchName || '');
                reason = FX.Parameters.blocked(parameterProfile, next, String(p.name || p.matchName));
                if (reason) {
                    skip(next, reason, String(p.name || p.matchName));
                } else if (p.propertyType !== PropertyType.PROPERTY) {
                    walk(p, next, depth + 1);
                } else {
                    read(p, next);
                }
            } catch (error) {
                skip(next, 'read-error');
            }
        }
    }
    if (paths && paths.length) {
        for (var pi = 0; pi < paths.length; pi++) {
            try {
                var selected = self.resolveProperty(effect, paths[pi]);
                if (selected.propertyType !== PropertyType.PROPERTY) {
                    skip(paths[pi], 'static-only');
                } else {
                    read(selected, paths[pi]);
                }
            } catch (pathError) {
                skip(paths[pi], 'read-error');
            }
        }
    } else {
        try {
            walk(effect, [], 0);
        } catch (error2) {
            skip([{ matchName: out.effectMatchName, index: 1 }], 'read-error');
        }
    }
    return out;
};
FX.AfterEffectsAdapter.prototype.parameterProfile = function (effect) {
    var matchName = String(effect.matchName),
        identified = FX.Parameters.profile(matchName, []),
        names = [], i;
    if (identified || /^ADBE /.test(matchName)) {
        return identified;
    }
    for (i = 1; i <= effect.numProperties; i++) {
        try {
            names.push(String(effect.property(i).name || ''));
        } catch (ignoredName) {}
    }
    return FX.Parameters.profile(matchName, names);
};
FX.AfterEffectsAdapter.prototype.parameterControl = function (effect, property, path, profile, valueType) {
    if (valueType !== 'OneD') {
        return null;
    }
    var c = { kind: 'number' }, labels = null, dropdown = false, units;
    try { labels = FX.Parameters.choices(property.propertyParameters); } catch (ignoredLabels) {}
    try { dropdown = property.isDropdownEffect === true; } catch (ignoredDropdown) {}
    if (labels) {
        c = { kind: 'menu', choices: labels, source: 'host' };
    } else if (profile === 'deep-glow-2' && FX.Parameters.normalize(property.name) === 'blendmode') {
        // Audited in the supplied UI: Screen is index 1, Add is index 2.
        c = { kind: 'menu', choices: [{ value: 1, label: 'Screen' }, { value: 2, label: 'Add' }], source: 'deep-glow-2' };
    } else if (dropdown) {
        return { kind: 'unavailable-menu' };
    }
    try { if (property.hasMin) { c.min = property.minValue; } } catch (ignoredMin) {}
    try { if (property.hasMax) { c.max = property.maxValue; } } catch (ignoredMax) {}
    try {
        units = property.unitsText || property.unitText;
        if (typeof units === 'string' && units.length <= 120) { c.units = units; }
    } catch (ignoredUnits) {}
    if (c.source === 'deep-glow-2' &&
        ((c.min !== undefined && c.min !== 1) || (c.max !== undefined && c.max !== 2))) {
        return { kind: 'unavailable-menu' };
    }
    if (c.kind === 'number' && c.min === undefined && c.max === undefined && !c.units) {
        return null;
    }
    FX.Validate.control(c);
    return c;
};
FX.AfterEffectsAdapter.prototype.parameterBlock = function (effect, path, valueType, profile) {
    var reason = FX.Parameters.blocked(profile, path, '', valueType), p;
    // Check stable host paths before resolving or reading the protected field.
    if (reason && reason !== 'not-public-parameter') {
        return reason;
    }
    p = this.resolveProperty(effect, path);
    return FX.Parameters.blocked(profile, path, String(p.name || p.matchName), valueType);
};
FX.AfterEffectsAdapter.prototype.resolveProperty = function (effect, path) {
    var current = effect,
        i,
        j,
        s,
        p,
        found;
    for (i = 0; i < path.length; i++) {
        s = path[i];
        p = current.property(s.index);
        if (p && String(p.matchName || '') === s.matchName) {
            current = p;
            continue;
        }
        found = null;
        for (j = 1; j <= current.numProperties; j++) {
            p = current.property(j);
            if (String(p.matchName || '') === s.matchName) {
                FX.U.assert(!found, 'Ambiguous property path');
                found = p;
            }
        }
        FX.U.assert(found, 'Property path unavailable');
        current = found;
    }
    return current;
};
FX.AfterEffectsAdapter.prototype.layerId = function (layer) {
    try {
        return layer.id === undefined ? null : Number(layer.id);
    } catch (error) {
        return null;
    }
};
FX.AfterEffectsAdapter.prototype.layerType = function (l) {
    if (l instanceof CameraLayer) {
        return 'Camera';
    }
    if (l instanceof LightLayer) {
        return 'Light';
    }
    if (l instanceof TextLayer) {
        return 'Text';
    }
    if (l instanceof ShapeLayer) {
        return 'Shape';
    }
    if (l.nullLayer) {
        return 'Null';
    }
    if (l.adjustmentLayer) {
        return 'Adjustment';
    }
    if (l.source instanceof CompItem) {
        return 'Precomposition';
    }
    if (l.source && l.source.mainSource instanceof SolidSource) {
        return 'Solid';
    }
    if (l.source instanceof FootageItem) {
        return 'Footage';
    }
    return 'Other';
};
FX.AfterEffectsAdapter.prototype.compositions = function () {
    var out = [],
        i,
        c;
    for (i = 1; i <= app.project.numItems; i++) {
        c = app.project.item(i);
        if (c instanceof CompItem) {
            out.push({ id: c.id, name: String(c.name) });
        }
    }
    return out;
};
FX.AfterEffectsAdapter.prototype.scopeComps = function (scope, ids) {
    var out = [],
        items = [],
        i,
        c;
    if (scope === 'active') {
        return [this.activeComp()];
    }
    if (scope === 'selected') {
        items = app.project.selection;
        for (i = 0; i < items.length; i++) {
            if (items[i] instanceof CompItem) {
                out.push(items[i]);
            }
        }
    } else {
        for (i = 1; i <= app.project.numItems; i++) {
            c = app.project.item(i);
            if (
                c instanceof CompItem &&
                (scope === 'entire' || FX.U.contains(ids || [], c.id))
            ) {
                out.push(c);
            }
        }
    }
    if (scope !== 'entire') {
        FX.U.assert(out.length > 0, 'Choose one or more compositions first.');
    }
    return out;
};
FX.AfterEffectsAdapter.prototype.layerRecord = function (c, l, scanId) {
    var parade = l.property('ADBE Effect Parade');
    return {
        scanId: scanId,
        compId: c.id,
        compName: String(c.name),
        layerId: this.layerId(l),
        layerIndex: l.index,
        layerName: String(l.name),
        layerType: this.layerType(l),
        label: Number(l.label),
        locked: !!l.locked,
        enabled: !!l.enabled,
        selected: !!l.selected,
        shy: !!l.shy,
        threeD: !!l.threeDLayer,
        adjustment: !!l.adjustmentLayer,
        effectCount: parade ? parade.numProperties : 0,
        stack: [],
        stackSignature: null
    };
};
FX.AfterEffectsAdapter.prototype.effectRecord = function (l, e, index, scanId) {
    var out = FX.U.clone(l);
    out.scanId = scanId;
    delete out.stack;
    delete out.stackSignature;
    out.effectIndex = index;
    out.effectName = String(e.name);
    out.matchName = String(e.matchName);
    out.enabled = null;
    out.metadataErrors = [];
    try {
        out.enabled = e.canSetEnabled ? !!e.enabled : true;
    } catch (stateError) {
        out.metadataErrors.push('enabled-unreadable');
        this.diagnostics.add(
            'scan-metadata',
            out.matchName,
            'enabled-unreadable'
        );
    }
    out.configuration = null;
    out.fingerprint = null;
    out.analysisState = 'basic';
    return out;
};
FX.AfterEffectsAdapter.prototype.stackEntry = function (e) {
    return {
        index: e.effectIndex,
        name: e.effectName,
        matchName: e.matchName
    };
};
FX.AfterEffectsAdapter.prototype.scanCursor = function (scope, ids) {
    return {
        project: app.project,
        comps: this.scopeComps(scope, ids),
        comp: 0,
        layer: 1,
        effect: 1,
        row: null,
        done: false,
        errors: 0
    };
};
FX.AfterEffectsAdapter.prototype.scanNext = function (cursor, scanId) {
    FX.U.assert(cursor.project === app.project, 'Project changed during scan');
    var c, l, p, e, out, index;
    if (cursor.comp >= cursor.comps.length) {
        cursor.done = true;
        return null;
    }
    c = cursor.comps[cursor.comp];
    if (cursor.layer > c.numLayers) {
        cursor.comp++;
        cursor.layer = 1;
        cursor.effect = 1;
        cursor.row = null;
        return null;
    }
    try {
        l = c.layer(cursor.layer);
        if (!cursor.row) {
            cursor.row = this.layerRecord(c, l, scanId);
            cursor.effect = 1;
        }
        p = l.property('ADBE Effect Parade');
        if (p && cursor.effect <= p.numProperties) {
            index = cursor.effect++;
            try {
                e = this.effectRecord(
                    cursor.row,
                    p.property(index),
                    index,
                    scanId
                );
                cursor.row.stack.push(this.stackEntry(e));
                return { kind: 'effect', value: e };
            } catch (effectError) {
                cursor.errors++;
                cursor.row.stack.push({ index: index, error: 'unreadable' });
                this.diagnostics.add(
                    'scan-effect',
                    String(index),
                    FX.U.errorText(effectError, 'ae')
                );
                return null;
            }
        }
        out = cursor.row;
        out.stackSignature = FX.JSON.stringify(out.stack);
        delete out.stack;
        cursor.row = null;
        cursor.layer++;
        cursor.effect = 1;
        return { kind: 'layer', value: out };
    } catch (error) {
        cursor.errors++;
        cursor.layer++;
        cursor.effect = 1;
        cursor.row = null;
        this.diagnostics.add('scan-layer', '', FX.U.errorText(error, 'ae'));
        return null;
    }
};
FX.AfterEffectsAdapter.prototype.resolveLayer = function (record) {
    var c = null,
        l = null,
        i,
        x;
    for (i = 1; i <= app.project.numItems; i++) {
        x = app.project.item(i);
        if (x instanceof CompItem && x.id === record.compId) {
            c = x;
            break;
        }
    }
    FX.U.assert(c, 'Composition no longer exists; Refresh.');
    for (i = 1; i <= c.numLayers; i++) {
        x = c.layer(i);
        if (record.layerId !== null && record.layerId !== undefined) {
            if (this.layerId(x) === record.layerId) {
                l = x;
                break;
            }
        } else if (i === record.layerIndex && x.name === record.layerName) {
            l = x;
            break;
        }
    }
    FX.U.assert(l, 'Layer no longer exists; Refresh.');
    return { comp: c, layer: l };
};
FX.AfterEffectsAdapter.prototype.resolve = function (record) {
    var t = this.resolveLayer(record),
        p = t.layer.property('ADBE Effect Parade'),
        e = p && p.property(record.effectIndex);
    FX.U.assert(
        e &&
            String(e.matchName) === record.matchName &&
            String(e.name) === record.effectName,
        'Effect stack changed; Refresh.'
    );
    t.effect = e;
    return t;
};
FX.AfterEffectsAdapter.prototype.validateLayer = function (
    record,
    allowLocked
) {
    var t = this.resolveLayer(record),
        p = t.layer.property('ADBE Effect Parade'),
        stack = [],
        i,
        e;
    FX.U.assert(allowLocked || !t.layer.locked, 'Layer is locked; skipped.');
    for (i = 1; p && i <= p.numProperties; i++) {
        e = p.property(i);
        stack.push({
            index: i,
            name: String(e.name),
            matchName: String(e.matchName)
        });
    }
    FX.U.assert(
        FX.JSON.stringify(stack) === record.stackSignature,
        'Effect stack changed since scan; Refresh.'
    );
    return t;
};
FX.AfterEffectsAdapter.prototype.analyzeOccurrence = function (
    record,
    filters
) {
    var target = this.resolve(record),
        out = FX.U.clone(record),
        configuration;
    if (
        !FX.Filters.layer(
            this.layerRecord(target.comp, target.layer, record.scanId),
            filters
        )
    ) {
        return null;
    }
    try {
        out.enabled = target.effect.canSetEnabled
            ? !!target.effect.enabled
            : true;
    } catch (stateError) {
        out.enabled = null;
        this.diagnostics.add(
            'analysis-metadata',
            out.matchName,
            'enabled-unreadable'
        );
    }
    if (!FX.Filters.basicEffect(out, filters)) {
        return null;
    }
    var checks = filters.properties || [],
        requestedPaths = [],
        ci;
    if (filters.property) {
        checks = checks.concat([filters.property]);
    }
    if (checks.length) {
        for (ci = 0; ci < checks.length; ci++) {
            requestedPaths.push(checks[ci].path);
        }
        configuration = this.capture(target.effect, requestedPaths);
        var propertyFilters = FX.U.clone(filters);
        delete propertyFilters.animation;
        if (
            !FX.Filters.effect(
                {
                    effectName: record.effectName,
                    matchName: record.matchName,
                    enabled: out.enabled,
                    configuration: configuration
                },
                propertyFilters
            )
        ) {
            return null;
        }
    }
    out.configuration = this.capture(target.effect);
    var fingerprintStarted = FX.U.now();
    out.fingerprint = FX.Config.fingerprint(out.configuration);
    this.diagnostics.measure('fingerprint', FX.U.now() - fingerprintStarted, 1);
    out.analysisState = 'analyzed';
    return out;
};
// Explicit inspection only: existing occurrence, selected paths, no effect creation.
FX.AfterEffectsAdapter.prototype.inspectAnimation = function (
    record,
    paths,
    layerRecord
) {
    FX.U.assert(
        paths && paths.length > 0 && paths.length <= 64,
        'Select 1 to 64 property paths.'
    );
    FX.U.assert(
        layerRecord &&
            FX.Model.layerKey(record) === FX.Model.layerKey(layerRecord),
        'Missing structural snapshot.'
    );
    this.validateLayer(layerRecord, true);
    var effect = this.resolve(record).effect,
        self = this,
        out = [],
        i;
    function interpolation(v) {
        if (typeof KeyframeInterpolationType !== 'undefined') {
            if (v === KeyframeInterpolationType.LINEAR) {
                return 'LINEAR';
            }
            if (v === KeyframeInterpolationType.HOLD) {
                return 'HOLD';
            }
            if (v === KeyframeInterpolationType.BEZIER) {
                return 'BEZIER';
            }
        }
        throw new Error('interpolation-unavailable');
    }
    function ease(v) {
        var result = [],
            j;
        FX.U.assert(v && v.length > 0, 'ease-unavailable');
        for (j = 0; j < v.length; j++) {
            FX.U.assert(
                typeof v[j].speed === 'number' &&
                    isFinite(v[j].speed) &&
                    typeof v[j].influence === 'number' &&
                    isFinite(v[j].influence),
                'ease-invalid'
            );
            result.push({ speed: v[j].speed, influence: v[j].influence });
        }
        return result;
    }
    for (i = 0; i < paths.length; i++) {
        var p,
            t = 'unknown',
            result = {
                path: paths[i],
                valueType: t,
                complete: true,
                reasons: [],
                data: { keys: [] }
            },
            count,
            k;
        function failure(field) {
            result.complete = false;
            result.reasons.push(field + ': unavailable');
            self.diagnostics.add(
                'animation-inspection',
                record.matchName,
                field + '-unavailable'
            );
            return null;
        }
        function field(name, fn) {
            try {
                return fn();
            } catch (readError) {
                return failure(name);
            }
        }
        function keyField(name, index, convert) {
            return field(name, function () {
                FX.U.assert(p[name], 'API unavailable');
                var v = p[name](index);
                return convert ? convert(v) : v;
            });
        }
        function numeric(v) {
            FX.U.assert(
                typeof v === 'number' && isFinite(v),
                'number unavailable'
            );
            return v;
        }
        function flag(v) {
            FX.U.assert(typeof v === 'boolean', 'flag unavailable');
            return v;
        }
        function vector(v) {
            FX.U.assert(v && v.length, 'vector unavailable');
            var a = [],
                j;
            for (j = 0; j < v.length; j++) {
                a.push(numeric(v[j]));
            }
            return a;
        }
        try {
            p = this.resolveProperty(effect, paths[i]);
            FX.U.assert(
                p && p.propertyType === PropertyType.PROPERTY,
                'Property unavailable'
            );
            t = this.valueType(p);
            result.valueType = t;
            FX.U.assert(
                FX.U.contains(
                    [
                        'OneD',
                        'TwoD',
                        'ThreeD',
                        'TwoD_SPATIAL',
                        'ThreeD_SPATIAL',
                        'COLOR'
                    ],
                    t
                ),
                'Unsupported type'
            );
            count = p.numKeys;
            FX.U.assert(
                typeof count === 'number' &&
                    isFinite(count) &&
                    count >= 0 &&
                    count === Math.floor(count),
                'Unknown key count'
            );
            result.data.keyCount = count;
            result.data.expression = field('expression', function () {
                return p.canSetExpression ? String(p.expression || '') : '';
            });
            result.data.expressionEnabled = false;
            if (result.data.expression) {
                result.data.expressionEnabled = field(
                    'expressionEnabled',
                    function () {
                        return flag(p.expressionEnabled);
                    }
                );
            }
            result.data.state = 'Static';
            if (count > 0) {
                result.data.state = 'Keyframed';
            }
            if (result.data.expression) {
                result.data.state = count > 0 ? 'Mixed' : 'Expression-driven';
            }
            if (count > 2000) {
                failure('key-limit-2000');
            }
            if (count === 0 && result.data.state === 'Static') {
                result.data.value = field('value', function () {
                    var v = p.value;
                    FX.Validate.value(t, v);
                    return FX.U.clone(v);
                });
            }
            for (k = 1; k <= count && k <= 2000; k++) {
                var key = { index: k };
                key.time = keyField('keyTime', k, numeric);
                key.value = keyField('keyValue', k, function (v) {
                    FX.Validate.value(t, v);
                    return FX.U.clone(v);
                });
                key.inInterpolation = keyField(
                    'keyInInterpolationType',
                    k,
                    interpolation
                );
                key.outInterpolation = keyField(
                    'keyOutInterpolationType',
                    k,
                    interpolation
                );
                key.inEase = keyField('keyInTemporalEase', k, ease);
                key.outEase = keyField('keyOutTemporalEase', k, ease);
                key.temporalAutoBezier = keyField(
                    'keyTemporalAutoBezier',
                    k,
                    flag
                );
                key.temporalContinuous = keyField(
                    'keyTemporalContinuous',
                    k,
                    flag
                );
                if (t === 'TwoD_SPATIAL' || t === 'ThreeD_SPATIAL') {
                    key.inSpatialTangent = keyField(
                        'keyInSpatialTangent',
                        k,
                        vector
                    );
                    key.outSpatialTangent = keyField(
                        'keyOutSpatialTangent',
                        k,
                        vector
                    );
                    key.spatialAutoBezier = keyField(
                        'keySpatialAutoBezier',
                        k,
                        flag
                    );
                    key.spatialContinuous = keyField(
                        'keySpatialContinuous',
                        k,
                        flag
                    );
                    key.roving = keyField('keyRoving', k, flag);
                }
                key.curve = FX.Animation.curve(key);
                result.data.keys.push(key);
            }
            if (result.data.expression === null) {
                result.data.state = 'Unsupported';
            }
        } catch (propertyError) {
            failure('property');
            result.data.state = 'Unsupported';
        }
        out.push(result);
    }
    return out;
};
FX.AfterEffectsAdapter.prototype._validateOccurrence = function (
    record,
    layerRecord
) {
    var target = this.resolve(record),
        observed;
    if (record.configuration && record.fingerprint) {
        observed = FX.Config.fingerprint(this.capture(target.effect));
        FX.U.assert(
            observed.canonical === record.fingerprint.canonical,
            'Configuration changed since scan; Refresh.'
        );
    } else {
        var stack = FX.JSON.parse(layerRecord.stackSignature),
            matches = 0,
            i;
        for (i = 0; i < stack.length; i++) {
            if (
                stack[i].name === record.effectName &&
                stack[i].matchName === record.matchName
            ) {
                matches++;
            }
        }
        FX.U.assert(
            matches === 1,
            'Repeated effect identifiers require Configuration Analysis before mutation.'
        );
        FX.U.assert(
            record.enabled !== null &&
                !!target.effect.enabled === record.enabled,
            'Effect state changed since scan; Refresh.'
        );
    }
    return target;
};
// Retain conservative full comparison: AE exposes no reliable per-effect revision token.
FX.AfterEffectsAdapter.prototype.capture = function (effect, paths) {
    var started = FX.U.now();
    try {
        return this._capture(effect, paths);
    } finally {
        FX.U.measure(this.diagnostics, 'capture', started, 1);
    }
};
FX.AfterEffectsAdapter.prototype.validateOccurrence = function (
    record,
    layerRecord
) {
    var started = FX.U.now();
    try {
        return this._validateOccurrence(record, layerRecord);
    } finally {
        FX.U.measure(this.diagnostics, 'validateOccurrence', started, 1);
    }
};
FX.AfterEffectsAdapter.prototype.validateKeyframeRemoval = function (effect, authorizations) {
    var i, p, authorization,
        profile = authorizations.length ? this.parameterProfile(effect) : null;
    for (i = 0; i < authorizations.length; i++) {
        authorization = authorizations[i];
        FX.U.assert(!this.parameterBlock(effect, authorization.path, authorization.valueType, profile),
            'Internal/system parameters cannot have their keyframes removed');
        p = this.resolveProperty(effect, authorization.path);
        var currentControl = this.parameterControl(effect, p, authorization.path, profile, authorization.valueType);
        FX.U.assert(!currentControl || currentControl.kind !== 'unavailable-menu', 'Dropdown options are unavailable; animation preserved');
        FX.U.assert(p.propertyType === PropertyType.PROPERTY && this.valueType(p) === authorization.valueType,
            'Keyframed property type changed; read parameters again');
        FX.U.assert(typeof authorization.keyCount === 'number' && authorization.keyCount > 0 &&
            isFinite(authorization.keyCount) &&
            authorization.keyCount === Math.floor(authorization.keyCount) &&
            p.numKeys === authorization.keyCount,
            'Keyframe count changed; read parameters again');
        FX.U.assert(!p.canSetExpression || String(p.expression || '').length === 0,
            'Expression property preserved; read parameters again');
        FX.U.assert(typeof p.removeKey === 'function' && typeof p.setValue === 'function',
            'Keyframe removal is unavailable for this property');
        if (FX.U.own(authorization, 'currentValue')) {
            FX.U.assert(FX.JSON.stringify(p.value) === FX.JSON.stringify(authorization.currentValue),
                'Current value changed; read parameters again before clearing keyframes');
        }
    }
};
// The editor requires every requested parameter on every selected occurrence.
// Validate the complete batch before the first setter or key removal.
FX.AfterEffectsAdapter.prototype.validateEditRows = function (effect, rows, authorizations) {
    var i, j, p, row, allowed, control, profile = this.parameterProfile(effect);
    for (i = 0; i < rows.length; i++) {
        row = rows[i];
        FX.U.assert(!this.parameterBlock(effect, row.path, row.valueType, profile), 'Protected parameter');
        p = this.resolveProperty(effect, row.path);
        FX.U.assert(p.propertyType === PropertyType.PROPERTY && this.valueType(p) === row.valueType,
            'Parameter unavailable or incompatible; no selected effects were changed');
        allowed = false;
        for (j = 0; j < authorizations.length; j++) {
            if (FX.Config.key(authorizations[j].path) === FX.Config.key(row.path)) { allowed = true; }
        }
        FX.U.assert(p.numKeys === 0 || allowed, 'Authorize keyframe removal for all selected effects');
        FX.U.assert(!p.canSetExpression || !String(p.expression || '').length, 'Expression property protected');
        FX.U.assert(typeof p.setValue === 'function', 'Parameter cannot be written');
        control = this.parameterControl(effect, p, row.path, profile, row.valueType);
        FX.Validate.rows([{ path: row.path, valueType: row.valueType, value: row.value, control: control }]);
        FX.U.assert(!control || control.kind !== 'unavailable-menu', 'Dropdown options unavailable');
        if (row.control && row.control.kind === 'menu') {
            FX.U.assert(control && control.kind === 'menu' &&
                FX.JSON.stringify(control.choices) === FX.JSON.stringify(row.control.choices), 'Dropdown options changed');
        }
    }
};
FX.AfterEffectsAdapter.prototype.writeRows = function (effect, rows, options) {
    options = options || {};
    var r = {
            failedBeforeWrite: 0,
            written: 0,
            verified: 0,
            verificationFailed: 0,
            unknown: 0,
            skipped: 0,
            failed: 0,
            keyframesRemoved: 0,
            animationMutationAttempted: false,
            reasons: [],
            outcomes: []
        },
        i,
        p,
        row,
        phase,
        started,
        item,
        requested,
        observed,
        authorizations = options.keyframes || [],
        authorization,
        a,
        keyIndex,
        parameterProfile = this.parameterProfile(effect),
        blockedReason,
        liveControl;
    FX.Validate.rows(rows);
    for (i = 0; i < rows.length; i++) {
        row = rows[i];
        phase = 'prepare';
        authorization = null;
        for (a = 0; a < authorizations.length; a++) {
            if (FX.Config.key(authorizations[a].path) === FX.Config.key(row.path)) {
                authorization = authorizations[a];
            }
        }
        item = { path: FX.U.clone(row.path), status: 'Failed Before Write', keyframesRemoved: 0 };
        r.outcomes.push(item);
        try {
            blockedReason = this.parameterBlock(effect, row.path, row.valueType, parameterProfile);
            if (blockedReason) {
                item.status = 'Skipped';
                item.reason = 'Protected parameter: ' + blockedReason;
                r.skipped++;
                r.reasons.push(item.reason);
                continue;
            }
            p = this.resolveProperty(effect, row.path);
            if (
                p.propertyType !== PropertyType.PROPERTY ||
                this.valueType(p) !== row.valueType
            ) {
                item.status = 'Skipped';
                item.reason = 'Unsupported property';
            } else {
                var keys = p.numKeys;
                if (
                    typeof keys !== 'number' ||
                    !isFinite(keys) ||
                    keys < 0 ||
                    keys !== Math.floor(keys)
                ) {
                    item.status = 'Skipped';
                    item.reason = 'Unknown animation state preserved';
                } else if (
                    (keys > 0 && !authorization) ||
                    (p.canSetExpression &&
                        String(p.expression || '').length > 0)
                ) {
                    item.status = 'Skipped';
                    item.reason = 'Animated/expression property preserved';
                }
            }
            if (item.status === 'Skipped') {
                r.skipped++;
                r.reasons.push(item.reason);
                continue;
            }
            FX.Validate.value(row.valueType, row.value);
            liveControl = this.parameterControl(effect, p, row.path, parameterProfile, row.valueType);
            FX.U.assert(!liveControl || liveControl.kind !== 'unavailable-menu', 'Dropdown options are unavailable; parameter preserved');
            if (liveControl && liveControl.kind === 'menu') {
                FX.U.assert(FX.Parameters.menuValue(liveControl, row.value) !== null, 'Invalid dropdown choice');
            }
            if (row.control && row.control.kind === 'menu') {
                FX.U.assert(liveControl && liveControl.kind === 'menu' &&
                    FX.JSON.stringify(liveControl.choices) === FX.JSON.stringify(row.control.choices),
                    'Dropdown options changed; read parameters again');
            }
            if (row.valueType === 'OneD') {
                FX.U.assert(
                    !p.hasMin || row.value >= p.minValue,
                    'Value below minimum'
                );
                FX.U.assert(
                    !p.hasMax || row.value <= p.maxValue,
                    'Value above maximum'
                );
            }
            requested = FX.U.clone(row.value);
            if (authorization) {
                this.validateKeyframeRemoval(effect, [authorization]);
                // Removing descending indices keeps remaining keys addressable.
                for (keyIndex = authorization.keyCount; keyIndex >= 1; keyIndex--) {
                    phase = 'remove-keys';
                    r.animationMutationAttempted = true;
                    p.removeKey(keyIndex);
                    r.keyframesRemoved++;
                    item.keyframesRemoved++;
                    FX.U.assert(p.numKeys === keyIndex - 1, 'Keyframe removal could not be verified');
                }
            }
            phase = 'write';
            started = FX.U.now();
            try {
                p.setValue(requested);
            } finally {
                FX.U.measure(this.diagnostics, 'setValue', started, 1);
            }
            // A returned setValue is a write even when the following read fails.
            r.written++;
            phase = 'readback';
            started = FX.U.now();
            try {
                observed = p.value;
                FX.Validate.value(row.valueType, observed);
                if (authorization) {
                    FX.U.assert(p.numKeys === 0, 'Keyframes remain after conversion to a fixed value');
                }
                FX.U.assert(
                    FX.JSON.stringify(observed) ===
                        FX.JSON.stringify(row.value),
                    'Host normalized, rounded or did not retain requested value'
                );
            } finally {
                FX.U.measure(this.diagnostics, 'readback', started, 1);
            }
            item.status = 'Written and Verified';
            r.verified++;
        } catch (error) {
            r.failed++;
            if (phase === 'write' || phase === 'remove-keys') {
                item.status = 'Unknown After Host Error';
                r.unknown++;
            } else if (phase === 'readback') {
                item.status = 'Written but Verification Failed';
                r.verificationFailed++;
            }
            if (phase === 'prepare') {
                r.failedBeforeWrite++;
            }
            item.reason = FX.U.errorText(error, 'write-property/' + phase);
            r.reasons.push(item.reason);
            this.diagnostics.error('write-property/' + phase, error);
            if (authorization && (phase === 'remove-keys' || phase === 'write')) {
                for (a = i + 1; a < rows.length; a++) {
                    r.skipped++;
                    r.outcomes.push({ path: FX.U.clone(rows[a].path), status: 'Skipped', reason: 'Stopped after uncertain animation mutation' });
                }
                break;
            }
        }
    }
    return r;
};
FX.AfterEffectsAdapter.prototype.addEffect = function (
    record,
    matchName,
    beforeWrite
) {
    var t = this.resolveLayer(record),
        p = t.layer.property('ADBE Effect Parade');
    FX.U.assert(!t.layer.locked, 'Layer is locked');
    FX.U.assert(
        p && p.canAddProperty(matchName),
        'Effect unavailable or incompatible with layer'
    );
    if (beforeWrite) {
        beforeWrite();
    }
    var index = p.addProperty(matchName).propertyIndex;
    return t.layer.property('ADBE Effect Parade').property(index);
};
FX.AfterEffectsAdapter.prototype.selectLayers = function (records) {
    FX.U.assert(records.length, 'Select results first');
    var compId = records[0].compId,
        t = this.resolveLayer(records[0]),
        i;
    t.comp.openInViewer();
    for (i = 1; i <= t.comp.numLayers; i++) {
        t.comp.layer(i).selected = false;
    }
    for (i = 0; i < records.length; i++) {
        if (records[i].compId === compId) {
            this.resolveLayer(records[i]).layer.selected = true;
        }
    }
};
FX.AfterEffectsAdapter.prototype.locate = function (record) {
    this.selectLayers([record]);
    if (record.effectIndex) {
        try {
            this.resolve(record).effect.selected = true;
        } catch (e) {
            this.diagnostics.add(
                'locate',
                record.matchName,
                FX.U.errorText(e, 'ae')
            );
        }
    }
};
FX.AfterEffectsAdapter.prototype.schedule = function (callbackName, epoch) {
    var argument = '';
    if (typeof epoch === 'number') {
        argument = String(epoch);
    }
    var code =
        'if (typeof ' +
        callbackName +
        ' === \"function\") { ' +
        callbackName +
        '(' +
        argument +
        '); }';
    var id = app.scheduleTask(code, 25, false);
    this.diagnostics.measure('tasksScheduled', 0, 1);
    return id;
};
FX.AfterEffectsAdapter.prototype.cancelTask = function (id) {
    if (id !== null) {
        app.cancelTask(id);
        this.diagnostics.measure('tasksCancelled', 0, 1);
    }
};

// MODULE: scanner/scanner.js
FX.Scanner = function (adapter) {
    this.adapter = adapter;
    this.job = null;
    this.result = null;
    this.basic = null;
    this.inventoryCache = null;
    this.configurations = {};
    this.analyses = [];
    this.analysisRevision = 0;
    this.task = null;
    this.ticking = false;
    this.onProgress = function () {};
    this.onDone = function () {};
    this.onObserverError = function () {};
};
// Basic Scan never captures property values or builds configuration fingerprints.
FX.Scanner.prototype.start = function (scope, ids) {
    // Prepare first: a failed scope lookup must not erase a usable session.
    var phaseStarted = FX.U.now(),
        cursor;
    try {
        cursor = this.adapter.scanCursor(scope || 'active', ids);
    } catch (error) {
        // Preserve a valid same-project session, never a snapshot of another project.
        try {
            if (this.basic && this.basic.project !== this.adapter.project()) {
                this.invalidate();
            }
        } catch (projectError) {
            this.invalidate();
        }
        throw error;
    }
    this.cancel();
    if (this.basic) {
        this.basic.stale = true;
    }
    if (this.result) {
        this.result.stale = true;
    }
    this.inventoryCache = null;
    this.job = {
        phase: 'basic',
        id: FX.U.id('scan'),
        cursor: cursor,
        layers: [],
        instances: [],
        scope: scope || 'active',
        startedAt: phaseStarted
    };
    this.adapter.diagnostics.measure(
        'scopePreparation',
        FX.U.now() - phaseStarted,
        this.job.cursor.comps.length
    );
    this.adapter.diagnostics.add('scanner', '', 'basic-start');
};
// Deep reads are a separate requested phase over a completed inventory; callers
// may continue an explicit edit by rereading only its recovered work targets.
FX.Scanner.prototype.analyze = function (filters, targets) {
    var phaseStarted = FX.U.now();
    FX.U.assert(
        !this.job &&
            this.basic &&
            !this.basic.stale &&
            this.basic.project === this.adapter.project(),
        'Complete a fresh Basic Scan first.'
    );
    var base = this.basic,
        request = FX.U.clone(filters || {}),
        candidates = FX.Filters.apply(base, request, true),
        index = {},
        i;
    if (request.animation && request.animation !== 'Any') {
        var known = [],
            observed;
        for (i = 0; i < candidates.instances.length; i++) {
            observed =
                this.configurations[
                    '$' + FX.Model.effectKey(candidates.instances[i])
                ];
            if (
                !observed ||
                !observed.configuration ||
                FX.Animation.matches(
                    observed ? observed.configuration : null,
                    request.animation
                )
            ) {
                known.push(candidates.instances[i]);
            }
        }
        candidates.instances = known;
    }
    if (targets) {
        var allowed = {},
            scoped = [];
        for (i = 0; i < targets.length; i++) {
            FX.U.assert(targets[i].scanId === base.id, 'Mixed scan results');
            allowed['$' + FX.Model.effectKey(targets[i])] = true;
        }
        for (i = 0; i < candidates.instances.length; i++) {
            if (allowed['$' + FX.Model.effectKey(candidates.instances[i])]) {
                scoped.push(candidates.instances[i]);
            }
        }
        candidates.instances = scoped;
    }
    for (i = 0; i < base.layers.length; i++) {
        index['$' + FX.Model.layerKey(base.layers[i])] = base.layers[i];
    }
    this.result = null;
    this.job = {
        phase: 'configuration',
        id: base.id,
        base: base,
        filters: request,
        layers: candidates.layers,
        candidates: candidates.instances,
        index: 0,
        instances: [],
        layerIndex: index,
        validated: {},
        cache: {},
        errors: 0
    };
    this.job.startedAt = phaseStarted;
    this.adapter.diagnostics.measure(
        'analysisPreparation',
        FX.U.now() - phaseStarted,
        candidates.instances.length
    );
    this.adapter.diagnostics.add(
        'scanner',
        '',
        'configuration-start; candidates=' + candidates.instances.length
    );
};
FX.Scanner.prototype.tick = function () {
    if (!this.job || this.ticking) {
        return false;
    }
    this.ticking = true;
    var job = this.job,
        deadline = FX.U.now() + 12,
        count = 0,
        event,
        item,
        fp,
        bucket,
        key,
        i,
        stepStarted,
        readStarted;
    try {
        while (count < 30 && FX.U.now() < deadline) {
            stepStarted = FX.U.now();
            if (job.phase === 'basic') {
                if (job.cursor.done) {
                    break;
                }
                event = this.adapter.scanNext(job.cursor, job.id);
                if (event && event.kind === 'layer') {
                    job.layers.push(event.value);
                } else if (event) {
                    job.instances.push(event.value);
                }
            } else {
                FX.U.assert(
                    job.base.project === this.adapter.project(),
                    'Project changed during Configuration Analysis'
                );
                if (job.index >= job.candidates.length) {
                    break;
                }
                item = job.candidates[job.index++];
                key = '$' + FX.Model.layerKey(item);
                if (!job.validated[key]) {
                    this.adapter.validateLayer(job.layerIndex[key], true);
                    job.validated[key] = true;
                }
                readStarted = FX.U.now();
                try {
                    item = this.adapter.analyzeOccurrence(item, job.filters);
                } finally {
                    this.adapter.diagnostics.measure(
                        'occurrenceRead',
                        FX.U.now() - readStarted,
                        1
                    );
                }
                if (item) {
                    fp = item.fingerprint;
                    key = '$' + fp.hash;
                    bucket = job.cache[key] || [];
                    for (i = 0; i < bucket.length; i++) {
                        if (bucket[i].canonical === fp.canonical) {
                            item.fingerprint = bucket[i];
                            break;
                        }
                    }
                    if (i === bucket.length) {
                        bucket.push(fp);
                        job.cache[key] = bucket;
                    }
                    job.instances.push(item);
                }
            }
            this.adapter.diagnostics.measure(
                'scanStep',
                FX.U.now() - stepStarted,
                1
            );
            count++;
        }
        var done =
            job.phase === 'basic'
                ? job.cursor.done
                : job.index >= job.candidates.length;
        var position = job.phase === 'basic' ? job.cursor.comp : job.index;
        var total =
            job.phase === 'basic'
                ? job.cursor.comps.length
                : job.candidates.length;
        this.notify('onProgress', [
            job.layers.length,
            job.instances.length,
            position,
            total,
            job.phase
        ]);
        if (this.job !== job) {
            return !!this.job;
        }
        if (done) {
            if (job.phase === 'basic') {
                this.configurations = {};
                this.analyses = [];
                this.analysisRevision = 0;
                this.inventoryCache = null;
                this.result = {
                    id: job.id,
                    project: job.cursor.project,
                    scope: job.scope,
                    layers: job.layers,
                    instances: job.instances,
                    scannedAt: FX.U.now(),
                    stale: false,
                    errorCount: job.cursor.errors,
                    analysisState: 'basic',
                    filters: null
                };
                this.basic = this.result;
            } else {
                var filtered = FX.Filters.apply(
                    { layers: job.layers, instances: job.instances },
                    job.filters
                );
                this.result = {
                    id: job.id,
                    project: job.base.project,
                    scope: job.base.scope,
                    layers: filtered.layers,
                    instances: filtered.instances,
                    scannedAt: job.base.scannedAt,
                    analyzedAt: FX.U.now(),
                    stale: false,
                    errorCount: job.base.errorCount + job.errors,
                    analysisState: 'analyzed',
                    filters: job.filters
                };
                var keys = [];
                for (i = 0; i < job.candidates.length; i++) {
                    delete this.configurations[
                        '$' + FX.Model.effectKey(job.candidates[i])
                    ];
                }
                // A captured non-match still has useful, authorized classification data.
                for (i = 0; i < job.instances.length; i++) {
                    item = job.instances[i];
                    key = '$' + FX.Model.effectKey(item);
                    this.configurations[key] = item;
                }
                for (i = 0; i < filtered.instances.length; i++) {
                    keys.push('$' + FX.Model.effectKey(filtered.instances[i]));
                }
                this.analyses.push({
                    at: this.result.analyzedAt,
                    filters: job.filters,
                    keys: keys
                });
                this.analysisRevision++;
                this.inventoryCache = null;
                if (this.analyses.length > 20) {
                    this.analyses.shift();
                }
            }
            this.adapter.diagnostics.measure(
                job.phase === 'basic' ? 'basicScan' : 'configurationAnalysis',
                FX.U.now() - job.startedAt,
                job.instances.length
            );
            this.adapter.diagnostics.add(
                'scanner',
                '',
                job.phase + '-complete; effects=' + job.instances.length
            );
            this.job = null;
            this.notify('onDone', [this.result]);
            // onDone may explicitly request the second phase. Its next tick stays cancellable.
            return !!this.job;
        }
        return true;
    } catch (error) {
        if (typeof stepStarted === 'number') {
            this.adapter.diagnostics.measure(
                'failedStep',
                FX.U.now() - stepStarted,
                1
            );
        }
        this.adapter.diagnostics.error('scan-read', error);
        this.invalidate();
        throw error;
    } finally {
        this.ticking = false;
    }
};
// Presentation observers cannot turn a completed read into a stale/failed scan.
FX.Scanner.prototype.notify = function (name, args) {
    try {
        this[name].apply(this, args);
    } catch (error) {
        try {
            this.adapter.diagnostics.error('presentation/' + name, error);
        } catch (ignoredDiagnostic) {}
        try {
            this.onObserverError(name, error);
        } catch (ignoredObserver) {}
    }
};
FX.Scanner.prototype.cancel = function () {
    if (this.job) {
        this.adapter.diagnostics.measure(
            this.job.phase === 'basic'
                ? 'basicScanCancelled'
                : 'configurationAnalysisCancelled',
            FX.U.now() - this.job.startedAt,
            this.job.instances.length
        );
        this.adapter.diagnostics.add(
            'scanner',
            '',
            this.job.phase + '-cancelled'
        );
    }
    this.job = null;
    if (this.task !== null) {
        var pending = this.task;
        this.task = null;
        try {
            this.adapter.cancelTask(pending);
        } catch (cancelError) {
            this.adapter.diagnostics.add('scheduler', '', 'cancel-failed');
            this.adapter.diagnostics.error('cancel-task', cancelError);
        }
    }
};
FX.Scanner.prototype.invalidate = function () {
    this.cancel();
    this.inventoryCache = null;
    if (this.result) {
        this.result.stale = true;
    }
    if (this.basic) {
        this.basic.stale = true;
    }
};
FX.Scanner.prototype.current = function () {
    FX.U.assert(
        this.basic &&
            !this.basic.stale &&
            !this.job &&
            this.basic.project === this.adapter.project(),
        'Run a fresh Scan first.'
    );
    return this.inventory();
};
// A lightweight view shares records, configurations and layer arrays with their owners.
// This method is pure: Display Search and rendering never read the host.
FX.Scanner.prototype.inventory = function () {
    if (!this.basic) {
        return null;
    }
    if (this.inventoryCache) {
        this.adapter.diagnostics.measure('inventoryReuse', 0, 1);
        return this.inventoryCache;
    }
    var inventoryStarted = FX.U.now();
    var out = {},
        k,
        i,
        e;
    for (k in this.basic) {
        if (FX.U.own(this.basic, k)) {
            out[k] = this.basic[k];
        }
    }
    out.instances = [];
    for (i = 0; i < this.basic.instances.length; i++) {
        e = this.basic.instances[i];
        out.instances.push(
            this.configurations['$' + FX.Model.effectKey(e)] || e
        );
    }
    out.analysisState = this.analyses.length ? 'analyzed' : 'basic';
    this.inventoryCache = out;
    this.adapter.diagnostics.measure(
        'inventoryBuild',
        FX.U.now() - inventoryStarted,
        out.instances.length
    );
    return out;
};

// MODULE: batch/batch.js
FX.Batch = function (adapter, scanner) {
    this.adapter = adapter;
    this.scanner = scanner;
};
FX.Batch.prototype.preview = function (targets, operation, options) {
    FX.U.assert(
        FX.U.contains(
            ['set', 'copy', 'enable', 'disable', 'remove', 'apply'],
            operation
        ),
        'Unknown operation'
    );
    FX.U.assert(targets.length > 0, 'Select results first');
    options = options || {};
    FX.U.assert(!options.requireAll || operation === 'set', 'All-selected editing requires a set operation');
    if (operation === 'set' || operation === 'copy') {
        FX.Validate.rows(options.rows);
        for (var policyTarget = 0; policyTarget < targets.length; policyTarget++) {
            var policyConfig = targets[policyTarget].configuration,
                policyProfile = FX.Parameters.fromConfig(policyConfig);
            for (var policyRow = 0; policyRow < options.rows.length; policyRow++) {
                FX.U.assert(!FX.Parameters.blocked(policyProfile, options.rows[policyRow].path,
                    options.rows[policyRow].name, options.rows[policyRow].valueType),
                    'Internal/system parameters are protected; select public effect controls only');
                var targetRow = FX.Config.row(policyConfig, options.rows[policyRow].path),
                    requestedControl = options.rows[policyRow].control;
                if (targetRow && !targets[policyTarget].locked && requestedControl && requestedControl.kind === 'menu') {
                    FX.U.assert(targetRow.control && targetRow.control.kind === 'menu' &&
                        FX.JSON.stringify(targetRow.control.choices) === FX.JSON.stringify(requestedControl.choices),
                        'Dropdown options differ from this source/preset; select compatible targets');
                }
            }
        }
    }
    var removalRequests = options.removeKeyframes || [],
        removals = {}, removalSeen = {}, ri, rj, requestedRow, animation, found, removalCount = 0;
    FX.U.assert(FX.U.array(removalRequests), 'Invalid keyframe removal paths');
    FX.U.assert(!removalRequests.length || operation === 'set',
        'Keyframe removal is available only in the parameter editor');
    for (ri = 0; ri < removalRequests.length; ri++) {
        key = '$' + FX.Config.key(removalRequests[ri]);
        FX.U.assert(!removalSeen[key], 'Duplicate keyframe removal path');
        removalSeen[key] = true;
        requestedRow = null;
        for (rj = 0; rj < options.rows.length; rj++) {
            if (FX.Config.key(options.rows[rj].path) === FX.Config.key(removalRequests[ri])) {
                requestedRow = options.rows[rj];
            }
        }
        FX.U.assert(requestedRow, 'Keyframe removal requires a new fixed value');
        found = false;
        for (rj = 0; rj < targets.length; rj++) {
            animation = FX.Config.state(targets[rj].configuration, requestedRow.path);
            if (!targets[rj].locked && FX.Config.removable(animation) && animation.valueType === requestedRow.valueType) {
                key = '$' + FX.Model.effectKey(targets[rj]);
                if (!removals[key]) {
                    removals[key] = [];
                }
                var authorization = { path: requestedRow.path, valueType: requestedRow.valueType, keyCount: animation.keyCount };
                if (requestedRow.keepCurrent) {
                    FX.U.assert(FX.U.own(animation, 'currentValue'), 'Current value unavailable; enter a fixed value');
                    authorization.currentValue = FX.U.clone(animation.currentValue);
                }
                removals[key].push(authorization);
                removalCount += animation.keyCount;
                found = true;
            }
        }
        FX.U.assert(found, 'No eligible keyframes for this parameter; read parameters again');
    }
    var targetRows = {}, tr, tj, change, occurrence, resolved, status;
    if (operation === 'set') {
        for (tr = 0; tr < targets.length; tr++) {
            occurrence = targets[tr];
            resolved = FX.U.clone(options.rows);
            for (tj = 0; tj < resolved.length; tj++) {
                change = resolved[tj];
                status = FX.Presentation.parameterStatus(occurrence, change.path);
                if (change.keepCurrent) {
                    FX.U.assert(removalSeen['$' + FX.Config.key(change.path)], 'Keeping current values requires explicit keyframe removal');
                    FX.U.assert(status.hasValue, 'Current value unavailable; enter a fixed value');
                    change.value = FX.U.clone(status.currentValue);
                    delete change.keepCurrent;
                }
                if (options.requireAll) {
                    FX.U.assert(!occurrence.locked && status.valueType === change.valueType &&
                        (status.editable || (status.removable && removalSeen['$' + FX.Config.key(change.path)])),
                        'Cannot update all selected effects for ' + change.name + ': ' + status.reason);
                }
            }
            targetRows['$' + FX.Model.effectKey(occurrence)] = resolved;
        }
    }
    if (operation === 'apply') {
        FX.U.assert(
            typeof options.matchName === 'string' &&
                options.matchName.length > 0,
            'Choose an effect'
        );
        if (options.rows) {
            FX.Validate.rows(options.rows);
            FX.U.assert(FX.Parameters.rows(options.matchName, options.rows).length === options.rows.length,
                'Internal/system parameters are protected; use public effect parameters in presets');
        }
    }
    var scan = this.scanner.current(),
        seen = {},
        i,
        t,
        key,
        comps = {},
        layers = {},
        nc = 0,
        nl = 0;
    for (i = 0; i < targets.length; i++) {
        t = targets[i];
        FX.U.assert(t.scanId === scan.id, 'Mixed scan results');
        key = FX.Model.layerKey(t);
        if (!layers['$' + key]) {
            layers['$' + key] = true;
            nl++;
        }
        if (!comps['$' + t.compId]) {
            comps['$' + t.compId] = true;
            nc++;
        }
        if (operation !== 'apply') {
            FX.U.assert(t.effectIndex, 'Select effect occurrences');
            if (operation === 'set' || operation === 'copy') {
                FX.U.assert(
                    t.configuration && t.fingerprint,
                    'Run Configuration Analysis before editing parameters.'
                );
            }
            key = FX.Model.effectKey(t);
        }
        FX.U.assert(!seen['$' + key], 'Duplicate target');
        seen['$' + key] = true;
    }
    return {
        scanId: scan.id,
        project: scan.project,
        operation: operation,
        targets: FX.U.clone(targets),
        options: FX.U.clone(options),
        keyframeRemovals: FX.U.clone(removals),
        keyframeCount: removalCount,
        targetRows: targetRows,
        layerCount: nl,
        compCount: nc
    };
};
// One synchronous batch at a time; callbacks can report progress but never re-enter writes.
FX.Batch.prototype.execute = function (plan) {
    FX.U.assert(!this.executing, 'A batch is already executing');
    var started = FX.U.now();
    this.executing = true;
    this.lastReport = null;
    try {
        return this._execute(plan);
    } finally {
        this.executing = false;
        this.scanner.invalidate();
        FX.U.measure(this.adapter.diagnostics, 'totalBatch', started, 1);
    }
};
FX.Batch.prototype._execute = function (plan) {
    var self = this,
        scan = this.scanner.current(),
        layerIndex = {},
        validated = {},
        blocked = {},
        i,
        t,
        key,
        report = {
            failedBeforeWrite: 0,
            changed: 0,
            created: 0,
            skipped: 0,
            failed: 0,
            written: 0,
            verified: 0,
            verificationFailed: 0,
            unknown: 0,
            propertiesSkipped: 0,
            keyframesRemoved: 0,
            outcomes: [],
            issues: [],
            affectedCompositions: [],
            completed: false
        };
    this.lastReport = report;
    FX.U.assert(
        plan.scanId === scan.id && plan.project === scan.project,
        'Scan is no longer current'
    );
    for (i = 0; i < scan.layers.length; i++) {
        layerIndex['$' + FX.Model.layerKey(scan.layers[i])] = FX.U.clone(
            scan.layers[i]
        );
    }
    var prevalidationStarted = FX.U.now();
    try {
        // All targets must pass before any write. Read neighbours' structure only.
        for (i = 0; i < plan.targets.length; i++) {
            t = plan.targets[i];
            key = '$' + FX.Model.layerKey(t);
            if (!validated[key]) {
                var row = layerIndex[key];
                FX.U.assert(row, 'Layer absent from scan');
                var target = this.adapter.resolveLayer(row);
                if (target.layer.locked) {
                    FX.U.assert(!plan.options.requireAll, 'A selected layer is locked; no effects were changed');
                    blocked[key] = true;
                } else {
                    this.adapter.validateLayer(row);
                }
                validated[key] = true;
            }
        }
        for (i = 0; i < plan.targets.length; i++) {
            t = plan.targets[i];
            key = '$' + FX.Model.layerKey(t);
            if (plan.operation !== 'apply' && !blocked[key]) {
                var checked = this.adapter.validateOccurrence(t, layerIndex[key]);
                this.adapter.validateKeyframeRemoval(checked.effect,
                    (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(t)] || []);
                if (plan.options.requireAll) {
                    this.adapter.validateEditRows(checked.effect,
                        plan.targetRows['$' + FX.Model.effectKey(t)],
                        (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(t)] || []);
                }
            }
        }
    } catch (validationError) {
        report.failed = plan.targets.length;
        report.failedBeforeWrite = plan.targets.length;
        report.issues.push({
            status: 'Failed Before Write',
            reason: FX.U.errorText(validationError, 'batch-prevalidation')
        });
        throw validationError;
    } finally {
        FX.U.measure(
            this.adapter.diagnostics,
            'prevalidation',
            prevalidationStarted,
            plan.targets.length
        );
    }
    var ordered = plan.targets.slice(0),
        enteredUndo = false;
    ordered.sort(function (a, b) {
        if (a.compId !== b.compId) {
            return a.compId - b.compId;
        }
        if (a.layerIndex !== b.layerIndex) {
            return a.layerIndex - b.layerIndex;
        }
        return (b.effectIndex || 0) - (a.effectIndex || 0);
    });
    function issue(t, status, reason) {
        report.issues.push({ target: t, status: status, reason: reason });
    }
    try {
        this.adapter.undo(
            plan.operation + ' ' + ordered.length + ' targets',
            function () {
                enteredUndo = true;
                for (i = 0; i < ordered.length; i++) {
                    t = ordered[i];
                    key = '$' + FX.Model.layerKey(t);
                    if (blocked[key]) {
                        report.skipped++;
                        issue(
                            t,
                            'Skipped',
                            'Target not attempted: layer locked or previous operation uncertain'
                        );
                        continue;
                    }
                    try {
                        if (self.onProgress) {
                            self.onProgress(i, ordered.length);
                        }
                    } catch (progressError) {
                        self.adapter.diagnostics.error(
                            'batch-progress',
                            progressError
                        );
                    }
                    var r = null,
                        current,
                        created = false,
                        mutationStarted = false;
                    try {
                        FX.U.assert(
                            self.adapter.project() === plan.project,
                            'Project changed during batch'
                        );
                        // Repeat structural validation immediately; account only for our confirmed removals.
                        self.adapter.validateLayer(layerIndex[key]);
                        if (plan.operation === 'apply') {
                            // Mark only the actual host invocation, after availability checks.
                            var added = self.adapter.addEffect(
                                t,
                                plan.options.matchName,
                                function () {
                                    mutationStarted = true;
                                }
                            );
                            created = true;
                            report.created++;
                            if (plan.options.rows) {
                                r = self.adapter.writeRows(
                                    added,
                                    plan.options.rows
                                );
                            }
                        } else {
                            current = self.adapter.validateOccurrence(
                                t,
                                layerIndex[key]
                            );
                            FX.U.assert(
                                !current.layer.locked,
                                'Layer became locked'
                            );
                            if (plan.operation === 'remove') {
                                mutationStarted = true;
                                current.effect.remove();
                                var stack = FX.JSON.parse(
                                        layerIndex[key].stackSignature
                                    ),
                                    si;
                                stack.splice(t.effectIndex - 1, 1);
                                for (si = 0; si < stack.length; si++) {
                                    stack[si].index = si + 1;
                                }
                                layerIndex[key].stackSignature =
                                    FX.JSON.stringify(stack);
                            } else if (
                                plan.operation === 'enable' ||
                                plan.operation === 'disable'
                            ) {
                                FX.U.assert(
                                    current.effect.canSetEnabled,
                                    'Effect cannot change enabled state'
                                );
                                mutationStarted = true;
                                current.effect.enabled =
                                    plan.operation === 'enable';
                            } else {
                                mutationStarted = true;
                                r = self.adapter.writeRows(
                                    current.effect,
                                    (plan.targetRows || {})['$' + FX.Model.effectKey(t)] || plan.options.rows,
                                    { keyframes: (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(t)] || [] }
                                );
                            }
                        }
                        if (r) {
                            report.failedBeforeWrite += r.failedBeforeWrite;
                            report.written += r.written;
                            report.verified += r.verified;
                            report.verificationFailed += r.verificationFailed;
                            report.unknown += r.unknown;
                            report.propertiesSkipped += r.skipped;
                            report.keyframesRemoved += r.keyframesRemoved || 0;
                            report.outcomes.push({
                                target: t,
                                properties: r.outcomes
                            });
                        }
                        if (r && r.failed) {
                            report.failed++;
                            issue(t, 'Property results', r.reasons.join('\n'));
                            if (r.written || r.keyframesRemoved || created) {
                                report.changed++;
                            }
                            if (r.animationMutationAttempted && r.unknown) {
                                blocked[key] = true;
                            }
                        } else if (r && !r.written) {
                            if (created) {
                                report.changed++;
                            } else {
                                report.skipped++;
                            }
                            issue(
                                t,
                                'Skipped',
                                r.reasons.join('\n') ||
                                    'No compatible static properties'
                            );
                        } else {
                            report.changed++;
                            if (r && r.skipped) {
                                issue(t, 'Skipped', r.reasons.join('\n'));
                            }
                        }
                        if (
                            (!r || r.written || r.unknown || created) &&
                            !FX.U.contains(
                                report.affectedCompositions,
                                t.compId
                            )
                        ) {
                            report.affectedCompositions.push(t.compId);
                        }
                    } catch (error) {
                        report.failed++;
                        if (created) {
                            report.changed++;
                        }
                        var status = 'Failed Before Write';
                        if (mutationStarted) {
                            status = 'Unknown After Host Error';
                            report.unknown++;
                            // Structural mutation may have happened. Never touch another target on this layer.
                            blocked[key] = true;
                            if (
                                !FX.U.contains(
                                    report.affectedCompositions,
                                    t.compId
                                )
                            ) {
                                report.affectedCompositions.push(t.compId);
                            }
                        }
                        if (!mutationStarted) {
                            report.failedBeforeWrite++;
                        }
                        issue(t, status, FX.U.errorText(error, 'batch-target'));
                        self.adapter.diagnostics.error('batch-target', error);
                    }
                }
            }
        );
        report.completed = true;
    } catch (hostError) {
        report.failed++;
        var status = 'Failed Before Write';
        if (enteredUndo) {
            status = 'Unknown After Host Error';
            report.unknown++;
        }
        if (!enteredUndo) {
            report.failedBeforeWrite++;
        }
        issue(null, status, FX.U.errorText(hostError, 'batch-undo'));
        this.adapter.diagnostics.error('batch-undo', hostError);
    }
    return report;
};

// MODULE: ui/presentation.js
// Pure presentation models. No host objects, reads or mutations.
FX.Presentation = (function () {
    function effectName(record) {
        var name = record.effectName || record.name || '';
        return /[A-Za-z0-9\u00c0-\uffff]/.test(name)
            ? name
            : record.matchName || 'Effect (unidentified)';
    }
    function value(v) {
        if (FX.U.array(v)) {
            return v.join(', ');
        }
        return String(v);
    }
    function groupTitle(g) {
        var parts = [],
            i;
        for (i = 0; i < g.summary.length && i < 2; i++) {
            parts.push(
                (g.summary[i].name || 'Parameter') +
                    ' ' +
                    value(g.summary[i].value)
            );
        }
        if (!parts.length) {
            var labels = {
                'Not Analyzed': 'Not analyzed',
                'Exact Comparable Match': 'Matching settings',
                'Matching Readable Settings': 'Readable settings match',
                'Not Comparable': 'Settings unavailable'
            };
            parts.push(labels[g.matchStatus] || g.matchStatus);
        }
        if (
            g.analyzed &&
            g.mode !== 'selected' &&
            g.instances[0].configuration.enabled === false
        ) {
            parts.push('Disabled');
        }
        parts.push(g.instances.length + ' effects');
        if (!g.complete && g.analyzed) {
            parts.push('Partial');
        }
        if (g.mode === 'selected') {
            parts.push('selected parameters only');
        }
        var animation = [],
            label;
        for (i = 0; i < g.instances.length; i++) {
            label = FX.Animation.summary(g.instances[i].configuration);
            if (!FX.U.contains(animation, label)) {
                animation.push(label);
            }
        }
        for (i = 0; i < animation.length; i++) {
            if (
                animation[i].indexOf('Animated') >= 0 ||
                animation[i].indexOf('Expression') >= 0
            ) {
                parts.push(animation[i]);
            }
        }
        return parts.join(' / ');
    }
    function editRows(instances) {
        var rows = [],
            byPath = {},
            i,
            j,
            config,
            p,
            k,
            r,
            seen,
            status,
            state,
            removalTypes,
            indexes = [],
            index,
            parameterProfile,
            controlSignature,
            nextSignature,
            menuMismatch;
        function add(p) {
            var key = '$' + FX.Config.key(p.path),
                row = byPath[key];
            if (!row) {
                row = {
                    path: p.path,
                    name: p.name || p.path[p.path.length - 1].matchName,
                    available: 0,
                    total: instances.length,
                    values: [],
                    reasons: [],
                    types: {},
                    safe: true
                };
                rows.push(row);
                byPath[key] = row;
            }
            return row;
        }
        for (i = 0; i < instances.length; i++) {
            config = instances[i].configuration;
            index = { properties: {}, states: {}, unsupported: {} };
            indexes.push(index);
            if (!config) {
                continue;
            }
            parameterProfile = FX.Parameters.fromConfig(config);
            index.profile = parameterProfile;
            for (j = 0; config.states && j < config.states.length; j++) {
                index.states['$' + FX.Config.key(config.states[j].path)] = config.states[j];
            }
            for (j = 0; j < config.properties.length; j++) {
                p = config.properties[j];
                if (FX.Parameters.blocked(parameterProfile, p.path, p.name, p.valueType)) {
                    continue;
                }
                index.properties['$' + FX.Config.key(p.path)] = p;
                r = add(p);
                r.available++;
                r.row = r.row || FX.U.clone(p);
                r.types['$' + p.valueType] = true;
            }
            for (j = 0; j < config.unsupported.length; j++) {
                p = config.unsupported[j];
                state = index.states['$' + FX.Config.key(p.path)];
                if (FX.Parameters.excluded(p.reason) || FX.Parameters.blocked(parameterProfile,
                    p.path, state ? state.name : p.name)) {
                    continue;
                }
                index.unsupported['$' + FX.Config.key(p.path)] = p.reason;
                r = add(p);
                state = index.states['$' + FX.Config.key(p.path)];
                if (state && state.name) {
                    r.name = state.name;
                }
                if (!FX.U.contains(r.reasons, p.reason)) {
                    r.reasons.push(p.reason);
                }
            }
        }
        for (i = 0; i < rows.length; i++) {
            r = rows[i];
            r.available = 0;
            r.removable = 0;
            r.keyframes = 0;
            r.singleKeyEffects = 0;
            r.valueGroups = [];
            r.unknownValues = 0;
            controlSignature = null;
            menuMismatch = false;
            r.control = null;
            removalTypes = {};
            for (j = 0; j < instances.length; j++) {
                status = parameterStatus(instances[j], r.path, indexes[j]);
                if (status.hasValue) {
                    seen = false;
                    for (k = 0; k < r.valueGroups.length; k++) {
                        if (FX.JSON.stringify(r.valueGroups[k].value) === FX.JSON.stringify(status.currentValue)) {
                            r.valueGroups[k].count++;
                            seen = true;
                            break;
                        }
                    }
                    if (!seen) {
                        r.values.push(status.currentValue);
                        r.valueGroups.push({ value: status.currentValue, count: 1 });
                    }
                } else { r.unknownValues++; }
                if (status.editable) {
                    r.available++;
                }
                if (status.removable) {
                    r.removable++;
                    r.keyframes += status.keyCount;
                    if (status.keyCount === 1) { r.singleKeyEffects++; }
                    state = indexes[j].states['$' + FX.Config.key(r.path)];
                    if (!r.row) {
                        r.row = { path: r.path, name: r.name, valueType: state.valueType };
                        if (status.hasValue) { r.row.value = FX.U.clone(status.currentValue); }
                        if (state.control) { r.row.control = FX.U.clone(state.control); }
                    }
                }
                if (status.editable || status.removable) {
                    removalTypes['$' + status.valueType] = true;
                    nextSignature = 'number';
                    if (status.control && status.control.kind === 'menu') {
                        nextSignature = FX.JSON.stringify(status.control.choices);
                    }
                    if (controlSignature !== null && nextSignature !== controlSignature) {
                        menuMismatch = true;
                    }
                    controlSignature = nextSignature;
                    if (!r.control && status.control) {
                        r.control = FX.U.clone(status.control);
                    } else if (r.control && status.control && r.control.kind === 'number' && status.control.kind === 'number') {
                        if (status.control.min !== undefined) {
                            r.control.min = r.control.min === undefined ? status.control.min : Math.max(r.control.min, status.control.min);
                        }
                        if (status.control.max !== undefined) {
                            r.control.max = r.control.max === undefined ? status.control.max : Math.min(r.control.max, status.control.max);
                        }
                    }
                }
            }
            var types = 0;
            for (k in r.types) {
                if (FX.U.own(r.types, k)) {
                    types++;
                }
            }
            r.safe = r.available > 0 && types === 1;
            types = 0;
            for (k in removalTypes) {
                if (FX.U.own(removalTypes, k)) {
                    types++;
                }
            }
            r.canRemoveKeyframes = r.removable > 0 && types === 1;
            if (menuMismatch || (r.control && r.control.min !== undefined && r.control.max !== undefined && r.control.min > r.control.max)) {
                r.safe = false;
                r.canRemoveKeyframes = false;
                r.reasons.push('incompatible control options or ranges');
            }
            if (r.row && r.control) { r.row.control = FX.U.clone(r.control); }
            r.category = 'Cannot edit safely';
            if (r.safe) {
                r.category =
                    r.available === r.total
                        ? 'All occurrences'
                        : 'Some occurrences';
            } else if (r.canRemoveKeyframes) {
                r.category = 'Animated (optional fixed value)';
            }
            r.current = 'Unavailable';
            if (r.values.length === 1 && !r.unknownValues) {
                r.current = FX.Parameters.display(r.row || {}, r.values[0]);
            } else if (r.values.length > 1) {
                r.current = 'Mixed Values';
            } else if (r.values.length && r.unknownValues) {
                r.current = 'Mixed / unavailable';
            } else if (r.removable) {
                r.current = 'Keyframed values unavailable';
            }
            var previous = [];
            for (k = 0; k < r.valueGroups.length; k++) {
                previous.push(FX.Parameters.display(r.row || {}, r.valueGroups[k].value) + ' (' + r.valueGroups[k].count + ')');
            }
            if (r.unknownValues) { previous.push('Unavailable (' + r.unknownValues + ')'); }
            r.previous = previous.join('; ');
            if (r.available < r.total && !r.reasons.length) {
                r.reasons.push('missing or not analyzed');
            }
            r.guidance = '';
            if (menuMismatch) {
                r.guidance = 'Dropdown options differ between these effects. Select a compatible subset; no option indices will be guessed.';
            } else if (FX.U.contains(r.reasons, 'menu-labels-unavailable') || FX.U.contains(r.reasons, 'menu-value-unavailable')) {
                r.guidance = 'Dropdown labels are unavailable. Edit this control in After Effects; no menu indices are guessed.';
            } else if (FX.U.contains(r.reasons, 'custom') || FX.U.contains(r.reasons, 'no-value')) {
                r.guidance = 'Graphical/custom control is not exposed as an editable numeric value. Edit it in After Effects; this batch preserves it.';
            } else if (FX.U.contains(r.reasons, 'keyframed') || FX.U.contains(r.reasons, 'expression')) {
                r.guidance = 'Authorize keyframe removal below to update all selected effects. Expressions remain protected.';
            }
        }
        return rows;
    }
    function parameterStatus(instance, path, index) {
        var config = instance.configuration,
            key = '$' + FX.Config.key(path),
            property = index ? index.properties[key] : FX.Config.row(config, path),
            state = index ? index.states[key] : FX.Config.state(config, path),
            out = {
                target: {
                    compName: instance.compName,
                    layerName: instance.layerName,
                    effectName: instance.effectName,
                    matchName: instance.matchName,
                    effectIndex: instance.effectIndex
                },
                editable: false,
                removable: false,
                keyCount: state ? state.keyCount || 0 : 0,
                valueType: property ? property.valueType : '',
                control: property ? property.control : null,
                hasValue: !!property || !!(state && FX.U.own(state, 'currentValue')),
                currentValue: property ? property.value : null,
                reason: 'Missing / unavailable'
            }, i;
        if (state && !property) {
            out.valueType = state.valueType || '';
            out.control = state.control || null;
            if (out.hasValue) { out.currentValue = state.currentValue; }
        }
        var parameterName = '';
        if (property) {
            parameterName = property.name;
        } else if (state) {
            parameterName = state.name;
        }
        var parameterProfile = index ? index.profile : FX.Parameters.fromConfig(config);
        if (FX.Parameters.blocked(parameterProfile, path, parameterName, out.valueType)) {
            out.reason = 'Protected internal/system parameter';
        } else if (instance.locked) {
            out.reason = 'Locked layer';
        } else if (!config) {
            out.reason = 'Not analyzed';
        } else if (state && (state.expressionPresent || state.state === 'Mixed' || state.state === 'Expression-driven')) {
            out.reason = 'Expression protected';
        } else if (property) {
            out.editable = true;
            out.reason = 'Editable (static)';
        } else if (FX.Config.removable(state)) {
            out.removable = true;
            out.reason = state.keyCount === 1 ? 'Single keyframe (can be cleared)' :
                'Keyframed: ' + state.keyCount + ' keyframes (preserved by default)';
        } else {
            if (index) {
                if (index.unsupported[key]) {
                    out.reason = 'Blocked: ' + index.unsupported[key];
                }
            } else {
                for (i = 0; i < config.unsupported.length; i++) {
                    if (FX.Config.key(config.unsupported[i].path) === FX.Config.key(path)) {
                        out.reason = 'Blocked: ' + config.unsupported[i].reason;
                        break;
                    }
                }
            }
        }
        return out;
    }
    function selectionState(selection, fresh) {
        var out = {
                action: 'none',
                message:
                    'Select an effect occurrence, or choose View > Layer to add an effect.',
                same: true,
                analyzed: true
            },
            i,
            editable = false,
            j, states, properties, config, profile;
        if (!fresh) {
            out.action = 'scan';
            out.message = 'Choose a composition and scan its effects.';
            return out;
        }
        for (i = 0; i < selection.instances.length; i++) {
            if (
                selection.instances[i].matchName !==
                selection.instances[0].matchName
            ) {
                out.same = false;
            }
            config = selection.instances[i].configuration;
            profile = FX.Parameters.fromConfig(config);
            if (!selection.instances[i].configuration) {
                out.analyzed = false;
            } else {
                properties = config.properties;
                for (j = 0; j < properties.length; j++) {
                    if (!FX.Parameters.blocked(profile, properties[j].path, properties[j].name, properties[j].valueType)) {
                        editable = true;
                    }
                }
                states = config.states || [];
                for (j = 0; j < states.length; j++) {
                    if (FX.Config.removable(states[j]) && !FX.Parameters.blocked(profile,
                        states[j].path, states[j].name, states[j].valueType)) {
                        editable = true;
                    }
                }
            }
        }
        if (!selection.instances.length) {
            if (selection.layers.length) {
                out.message =
                    'Layer selected. Click Add Effect to choose an effect supported by this layer.';
            }
            return out;
        }
        if (!out.analyzed) {
            out.action = 'analyze';
            out.message = out.same ?
                'Click Edit Parameters to read only the selected effects and open the editor.' :
                'Selected effect types differ. Read Parameters can inspect them; select one effect type to edit.';
        } else if (!out.same) {
            out.message =
                'Selected effects have different types. Select one effect type to edit.';
        } else if (!editable) {
            out.message =
                'No editable static parameters. Use More for inspection or other actions.';
        } else {
            out.action = 'edit';
            out.message =
                'Selected effects ready. Edit Parameters changes only the fields you fill in, even when current values differ.';
        }
        return out;
    }
    var help = [
        [
            'Start',
            'Choose Active Composition, Choose Compositions or Entire Project. Search or Enter creates a Basic inventory when missing or outdated; Scan explicitly refreshes it. Basic reads existing effect identities only. Opening the panel starts no scan or task.'
        ],
        [
            'Find and edit',
            'Search with Search or Enter, select effects of the same type and click Edit Parameters. That action reads only the selected effects when needed, then opens the editor. Fill several values and Apply once; the editor closes before confirmation and Batch. Successful edits refresh and reread only safely recovered targets. The editor stays closed; click Edit Parameters again to continue with updated values. Cancelled confirmation preserves the draft. Untouched fields never produce writes. More > Read Parameters provides inspection without opening the editor.'
        ],
        [
            'Selection',
            'Selected results use the native highlight color on every selected row. Click replaces the work selection. Ctrl-click toggles one occurrence, layer or group. Shift-click selects a range of visible rows of the same kind; Ctrl+Shift adds that range. [x] marks selected members; [-] marks partially selected groups; [ ] is unselected. Only marked results matching the current filters are operated on. Double-click a group, or use Left/Right, to collapse/expand it. Select Results explicitly selects matching results across pages. Clear Selection removes all choices, including hidden ones. More... > Selection... offers Select All and Invert Selection.'
        ],
        [
            'Groups and layers',
            'View lists Effects, Groups, then Layer. Groups compares occurrences by configuration after Read Parameters, never a set of different effects. More... > Grouping... chooses configuration, layer type or selected-parameter grouping without opening dialogs on View changes. Matching settings requires full comparable coverage; Readable settings match / Partial contains unknown data, including animation. Not analyzed is not equality. Decorative/blank instance names display matchName; Details preserves the original and can explicitly look up its registered name. Previous/Next displays 200 records per page; group selection may include off-page members shown in the counter and confirmation.'
        ],
        [
            'Editor',
            'Find parameter filters words in memory. Filters include Editable, Has keyframes, Pending changes and Unavailable. * marks a pending change; ! marks an invalid value that must be corrected before Apply. The parameter title repeats this state. Search preserves all pending edits; review the pending table and apply several parameters in one batch. Previous values includes static and keyframed current values with effect counts; View targets shows each value. Pending changes and confirmation show previous -> new values. Every pending parameter must apply to all selected effects; otherwise Apply is blocked with guidance. Dropdowns use host option names when available (AE 26+) or a verified compatibility profile; unknown options are never invented. View targets explains each occurrence. Clear this change / Clear all changes only discard pending edits. Keyframe removal includes single keys, is OFF by default and requires separate final consent. With removal checked, blank / Keep original clears keys and retains each current value; entering a value replaces every selected value. Expressions, locks, host Compositing Options, known internal fields and opaque data remain protected. AI Color Match exposes only verified Intensity. Cancel writes nothing.'
        ],
        [
            'Copy and presets',
            'More > Copy Parameters... chooses an analyzed source and static rows for a frozen session clipboard. Select analyzed destinations of the same matchName and use Paste Parameters...; confirmation precedes writes. Save Effect Preset... stores those chosen rows for one effect, with omissions explicit. Presets... edits values, renames, deletes and imports/exports the data-only JSON library with backups and conflict checks. Apply to selected effects uses matching types only. Add Effect... > Saved presets creates NEW instances and sets their static rows; it does not replace existing effects. A failed write may leave the newly created instance: inspect Results before retrying. Presets do not contain sets, expressions or animation.'
        ],
        [
            'More actions',
            'More... has direct buttons, closes before a work dialog, and requires applicable targets. Copy Settings From... prefers analyzed reference data; Effect Controls reference explicitly reads the selected AE effect. Compare... supports selected static differences A/B. Enable, Disable and Add Effect are direct actions. Remove remains in More. All mutations require confirmation. Layers that cannot host effects are refused safely. Enabled is not a license command. Remove deletes entire effects including animation. Details preserves the original instance name and technical identity.'
        ],
        [
            'Refresh and safety',
            'Successful operations refresh Basic identities and preserve Results. Successful parameter edits/copies also reread only safely recovered edited effects, as part of that edit request; other effects are not analyzed. Manual Scan/Refresh remains Basic only. Cancelling the follow-up update does not undo applied values. Read failure preserves Results and requires explicit recovery; uncertain writes never trigger automatic retry. Target identity, locks, expressions and protected fields are still checked. Keyframes are preserved unless removal is explicitly confirmed. Undo is one group per operation; failures may be partial.'
        ],
        [
            'Animation',
            'Inspect Animation... is read-only and explicitly reads chosen paths of one or two occurrences. Its table lists time, value and curve with supported ease/interpolation/spatial details. Edit Parameters can explicitly remove ALL keyframes of a chosen supported numeric parameter and apply a fixed value or keep each current value. A single keyframe can also be cleared. It does not move or change individual keys, copy animation or remove expressions. A separate final consent shows key counts. Unknown is never Static.'
        ],
        [
            'Troubleshooting',
            'Cancel removes queued work, but a synchronous host call cannot be interrupted until it returns. Locate chooses one Timeline composition. Help > Diagnostics... works without selection. No licensing data is requested or activation test run. Licensing prompts and host stalls have no established cause. Short docks have a vertical scrollbar; Page Up/Down works outside text fields and the results list. Wheel forwarding depends on host event delivery; the results list keeps native scrolling. Version is inside Help and Diagnostics. Native docking/layout and commercial testing remain pending.'
        ],
        [
            'Glow: 18 effects',
            'Search Glow, Select Results, Read Parameters. Choose Groups (default Configuration / layer type): Text Intensity 50 (3), Adjustment 6 (12), Adjustment 7 (3). Select only group 7, Edit Parameters..., type Intensity 6, Apply and confirm. Basic Refresh runs after successful changes. Read Parameters explicitly to regroup new configurations. Radius and Text remain unchanged. Values come from the project, not this example.'
        ]
    ];
    // Pure geometry: make overflow explicit instead of relying on a dock's minimum size.
    function viewport(width, height, pager, report, results) {
        width = Math.max(180, width);
        height = Math.max(1, height);
        function measure(contentWidth) {
            var wrap = contentWidth - 12 < 360,
                action = results && wrap ? 60 : 28,
                direct = wrap ? 60 : 28,
                sections = 5,
                fixed = 170 + 34 + 28 + action + direct + 12;
            if (pager) {
                fixed += 28;
                sections++;
            }
            if (report) {
                fixed += 70;
                sections++;
            }
            fixed += (sections - 1) * 5;
            var tree = Math.max(100, height - fixed);
            return {
                width: contentWidth,
                height: height,
                treeHeight: tree,
                actionHeight: action,
                directHeight: direct,
                contentHeight: fixed + tree
            };
        }
        var out = measure(width);
        if (out.contentHeight > height) {
            out = measure(Math.max(180, width - 18));
        }
        out.maxScroll = Math.max(0, out.contentHeight - height);
        out.scrollbar = out.maxScroll > 0;
        return out;
    }
    function rowWidths(width, weights, gap) {
        var sum = 0,
            out = [],
            i,
            used = 0,
            available = Math.max(0, width - gap * (weights.length - 1)),
            n;
        for (i = 0; i < weights.length; i++) {
            sum += weights[i];
        }
        for (i = 0; i < weights.length; i++) {
            n = Math.floor((available * weights[i]) / sum);
            if (i === weights.length - 1) {
                n = available - used;
            }
            out.push(n);
            used += n;
        }
        return out;
    }
    function wheelStep(event) {
        // Event availability differs by host. Never assume a wheel event is emitted.
        var n;
        try {
            n = event.deltaY;
            if (typeof n === 'number' && isFinite(n) && n !== 0) {
                return Math.max(-96, Math.min(96, n));
            }
            n = event.wheelDelta;
            if (typeof n === 'number' && isFinite(n) && n !== 0) {
                return n > 0 ? -48 : 48;
            }
            n = event.detail;
            if (typeof n === 'number' && isFinite(n) && n !== 0) {
                return n > 0 ? 48 : -48;
            }
        } catch (ignoredWheel) {}
        return 0;
    }
    function reportSummary(report) {
        var text = 'Updated ' + report.changed + ' effects.';
        if (report.unknown || report.verificationFailed) {
            text = 'Some results could not be confirmed. Review Results before applying again.';
        } else if (report.failed) {
            text = 'Completed with issues. Updated ' + report.changed + ' effects; failures: ' + report.failed + '. See Results.';
        } else if (report.skipped || report.propertiesSkipped) {
            text += ' Preserved/skipped: ' + report.skipped + ' effects / ' + report.propertiesSkipped + ' parameters. See Results.';
        } else if (report.verified) {
            text += ' ' + report.verified + ' parameter values verified.';
        }
        if (report.created) { text += ' New instances: ' + report.created + '.'; }
        if (report.keyframesRemoved) { text += ' Keyframes removed: ' + report.keyframesRemoved + '.'; }
        return text;
    }
    return {
        viewport: viewport,
        rowWidths: rowWidths,
        wheelStep: wheelStep,
        value: value,
        groupTitle: groupTitle,
        effectName: effectName,
        editRows: editRows,
        parameterStatus: parameterStatus,
        selectionState: selectionState,
        reportSummary: reportSummary,
        help: help
    };
})();

// MODULE: ui/results.js
// Hierarchical results backed by a native multiselect ListBox. TreeView can
// highlight only one item; work selection must remain visible on every row.
FX.Results = function (parent) {
    var control = parent.add('listbox', undefined, [], { multiselect: true }),
        tree = { control: control, items: [], selection: null },
        visible = [],
        syncing = false,
        keyboardTarget = null,
        ctrlGesture = false,
        shiftGesture = false,
        pendingClick = false;
    function add(owner, type, title) {
        var node = {
            text: title,
            type: type,
            items: [],
            expanded: false,
            add: function (kind, label) {
                return add(node, kind, label);
            }
        };
        owner.items.push(node);
        return node;
    }
    tree.add = function (type, title) {
        return add(tree, type, title);
    };
    tree.removeAll = function () {
        syncing = true;
        try {
            control.removeAll();
            tree.items = [];
            tree.selection = null;
            tree.anchor = null;
            visible = [];
            keyboardTarget = null;
        } finally {
            syncing = false;
        }
    };
    tree.refresh = function () {
        var next = [], i, n, label, indent, j, changed = false;
        function walk(owner) {
            var k, child;
            for (k = 0; k < owner.items.length; k++) {
                child = owner.items[k];
                next.push(child);
                if (child.expanded) {
                    walk(child);
                }
            }
        }
        walk(tree);
        changed = next.length !== visible.length;
        for (i = 0; !changed && i < next.length; i++) {
            changed = next[i] !== visible[i];
        }
        syncing = true;
        try {
            if (changed) {
                control.removeAll();
                visible = next;
            }
            for (i = 0; i < visible.length; i++) {
                n = visible[i];
                indent = '';
                for (j = 0; j < n.fxDepth; j++) {
                    indent += '    ';
                }
                label = '  ';
                if (n.type === 'node') {
                    label = n.expanded ? 'v ' : '> ';
                }
                label = indent + label + n.text;
                if (changed) {
                    n.fxItem = control.add('item', label);
                    n.fxItem.fxNode = n;
                } else if (n.fxItem.text !== label) {
                    n.fxItem.text = label;
                }
                // This is the work selection, including descendants of groups.
                // Focus is tracked separately and never adds an operation target.
                if (n.fxItem.selected !== !!n.fxSelected) {
                    n.fxItem.selected = !!n.fxSelected;
                }
            }
        } finally {
            syncing = false;
        }
    };
    function nativeSelection() {
        var selected = control.selection || [];
        return FX.U.array(selected) ? selected : [selected];
    }
    control.onChange = function () {
        if (syncing) {
            return;
        }
        var selected = nativeSelection(), candidate = keyboardTarget,
            changed = [], i, n, distance = -1, d, origin = -1;
        keyboardTarget = null;
        if (!candidate && shiftGesture && !ctrlGesture && tree.anchor) {
            for (i = 0; i < visible.length; i++) {
                if (visible[i] === tree.anchor) {
                    origin = i;
                }
            }
            for (i = 0; origin >= 0 && i < visible.length; i++) {
                d = Math.abs(i - origin);
                if (visible[i].fxItem.selected && d > distance) {
                    candidate = visible[i];
                    distance = d;
                }
            }
        }
        if (!candidate && !ctrlGesture && selected.length === 1) {
            candidate = selected[0].fxNode;
        }
        if (!candidate) {
            for (i = 0; i < visible.length; i++) {
                n = visible[i];
                if (n === tree.selection) {
                    origin = i;
                }
                if (!!n.fxItem.selected !== !!n.fxSelected) {
                    changed.push(i);
                }
            }
            // Ctrl toggles one row; Shift may change a range. Its endpoint is
            // the changed row furthest from the previous focus.
            for (i = 0; i < changed.length; i++) {
                d = Math.abs(changed[i] - origin);
                if (d > distance) {
                    distance = d;
                    candidate = visible[changed[i]];
                }
            }
        }
        if (candidate) {
            pendingClick = false;
            tree.selection = candidate;
            if (tree.onChange) {
                tree.onChange();
            }
        }
    };
    tree.addEventListener = function (name, callback, capture) {
        control.addEventListener(name, callback, capture);
    };
    function modifiers(event) {
        var keys = {};
        try {
            if (typeof ScriptUI !== 'undefined') {
                keys = ScriptUI.environment.keyboardState;
            }
        } catch (ignoredKeys) {}
        ctrlGesture = !!(event.ctrlKey || event.metaKey || keys.ctrlKey || keys.metaKey);
        shiftGesture = !!(event.shiftKey || keys.shiftKey);
    }
    control.addEventListener('mousedown', function (event) {
        pendingClick = true;
        keyboardTarget = null;
        modifiers(event);
    }, true);
    control.addEventListener('click', function (event) {
        // Clicking an already highlighted row need not emit onChange.
        if (pendingClick) {
            pendingClick = false;
            control.onChange();
        }
        // ScriptUI reports double clicks as click events with detail === 2.
        if (event.detail === 2) {
            toggle(tree.selection, tree.selection && !tree.selection.expanded);
        }
    });
    function toggle(node, expanded) {
        if (!node || node.type !== 'node' || !control.enabled) {
            return;
        }
        node.expanded = expanded;
        if (tree.onExpand) {
            tree.onExpand();
        } else {
            tree.refresh();
        }
    }
    control.addEventListener('keydown', function (event) {
        var key = event.keyName || '', i, index = -1;
        if (syncing) {
            return;
        }
        modifiers(event);
        if (key === 'Left' || key === 'Right') {
            toggle(tree.selection, key === 'Right');
            if (event.preventDefault) {
                event.preventDefault();
            }
            return;
        }
        for (i = 0; i < visible.length; i++) {
            if (visible[i] === tree.selection) {
                index = i;
            }
        }
        if (key === 'Up' || key === 'Down') {
            index += key === 'Up' ? -1 : 1;
        } else if (key === 'Home') {
            index = 0;
        } else if (key === 'End') {
            index = visible.length - 1;
        } else {
            keyboardTarget = null;
            return;
        }
        keyboardTarget = visible[Math.max(0, Math.min(visible.length - 1, index))];
    }, true);
    return tree;
};

// MODULE: ui/editor.js
// ScriptUI parameter editor. Host reads and writes belong to the caller.
FX.Editor = (function () {
    function open(o) {
        var d = o.dialog, rows = o.rows, drafts = FX.U.clone(o.drafts || {}),
            active = null, loading = true, filling = false, shown = false,
            result = null, fields = [], i, apply, updatingDrafts = false,
            validationErrors = [], invalidDrafts = {}, visibleRows = [];
        d.orientation = 'column';
        d.alignChildren = 'fill';
        d.minimumSize = [520, 280];
        d.add('statictext', undefined, FX.Presentation.effectName(o.instances[0]) +
            ' - ' + o.instances.length + ' effects / ' + o.layerCount + ' layers');
        var hint = d.add('statictext', undefined,
            '* marks a pending change; ! needs correction. Change several parameters, then Apply once. Blank values keep originals.',
            { multiline: true });
        hint.preferredSize = [600, 32];
        var searchRow = o.row(d);
        searchRow.add('statictext', undefined, 'Find parameter');
        var search = searchRow.add('edittext', undefined, '');
        search.fxParameterSearch = true;
        search.alignment = ['fill', 'center'];
        search.characters = 25;
        o.button(searchRow, 'Clear search', function () {
            search.text = '';
            rebuildList();
        });
        var filter = searchRow.add('dropdownlist', undefined,
            ['All parameters', 'Editable', 'Has keyframes', 'Pending changes', 'Unavailable']);
        filter.selection = 0;
        filter.fxParameterFilter = true;
        var count = d.add('statictext', undefined, ''),
            list = d.add('listbox', undefined, [], {
                numberOfColumns: 4, showHeaders: true,
                columnTitles: ['Parameter', 'Current value', 'New value', 'Applies to'],
                columnWidths: [205, 130, 125, 110]
            });
        list.fxParameterList = true;
        list.helpTip = '* = pending change. ! = invalid value. Search and filters preserve all pending changes.';
        list.preferredSize = [600, 132];
        var title = d.add('statictext', undefined, ''),
            current = d.add('statictext', undefined, '', { multiline: true });
        current.preferredSize = [600, 60];
        var previousValues = d.add('edittext', undefined, '', { multiline: true, scrolling: true, readonly: true });
        previousValues.preferredSize = [600, 44];
        previousValues.fxPreviousValues = true;
        var animationRow = o.row(d),
            removeAnimation = animationRow.add('checkbox', undefined, 'Remove keyframes (this parameter, all selected effects)');
        removeAnimation.fxRemoveAnimation = true;
        removeAnimation.value = false;
        var fieldRow = o.row(d);
        fieldRow.add('statictext', undefined, 'New value');
        // Stack alternative editors without collapsing their dimensions. A
        // zero-sized hidden EditText can retain that size after relayout in AE.
        var valueHost = fieldRow.add('group');
        valueHost.orientation = 'stack';
        valueHost.alignment = ['fill', 'center'];
        valueHost.alignChildren = ['fill', 'center'];
        valueHost.minimumSize.height = 24;
        var numberInputs = o.row(valueHost);
        numberInputs.alignChildren = ['left', 'center'];
        for (i = 0; i < 4; i++) {
            fields.push(numberInputs.add('edittext', undefined, ''));
            fields[i].characters = 9;
            fields[i].minimumSize = [78, 24];
            fields[i].fxParameterInput = true;
        }
        var menu = valueHost.add('dropdownlist', undefined, []);
        menu.fxParameterMenu = true;
        menu.minimumSize = [180, 24];
        menu.preferredSize.width = 230;
        var fieldHint = d.add('statictext', undefined, '', { multiline: true });
        fieldHint.preferredSize = [600, 30];
        var pendingTitle = d.add('statictext', undefined, ''),
            changes = d.add('listbox', undefined, [], {
                numberOfColumns: 3, showHeaders: true,
                columnTitles: ['Pending parameter', 'Previous -> New value', 'Action'],
                columnWidths: [140, 270, 190]
            });
        changes.fxPendingChanges = true;
        changes.preferredSize = [600, 60];
        var validation = d.add('statictext', undefined, '', { multiline: true });
        validation.preferredSize = [600, 32];
        var actions = o.row(d);
        o.button(actions, 'View targets', showTargets);
        o.button(actions, 'Clear this change', function () {
            loading = true;
            removeAnimation.value = false;
            for (var n = 0; n < fields.length; n++) { fields[n].text = ''; }
            menu.selection = 0;
            loading = false;
            remember();
            load(active);
            rebuildList();
        });
        o.button(actions, 'Clear all changes', function () {
            drafts = {};
            save();
            load(active);
            rebuildList();
        });
        var applyHint = d.add('statictext', undefined,
            'Apply updates the selected effects. To make more changes, use Edit Parameters again.');
        var footer = o.row(d);
        o.button(footer, 'Cancel', function () { remember(); d.close(0); });
        apply = o.button(footer, 'Apply', submit);
        apply.helpTip = 'Apply all pending changes after confirmation, then close the editor. The same safely recovered selection stays ready for Edit Parameters.';
        function key(r) { return '$' + FX.Config.key(r.path); }
        function show(control, flag) {
            control.visible = !!flag;
            control.maximumSize.height = flag ? 10000 : 0;
        }
        function layout() {
            if (shown && !d.fxClosed) { d.layout.layout(true); }
        }
        function isMenu(r) { return !!(r && r.row && r.row.control && r.row.control.kind === 'menu'); }
        function dimension(r) {
            if (!r || !r.row) { return 0; }
            if (r.row.valueType === 'OneD') { return 1; }
            if (r.row.valueType === 'COLOR') { return 4; }
            if (r.row.valueType === 'TwoD' || r.row.valueType === 'TwoD_SPATIAL') { return 2; }
            return 3;
        }
        function canEdit(r) { return !!r && (r.safe || (removeAnimation.value && r.canRemoveKeyframes)); }
        function model(entry) {
            for (var n = 0; n < rows.length; n++) {
                if (FX.Config.key(rows[n].path) === FX.Config.key(entry.row.path)) { return rows[n]; }
            }
            return null;
        }
        function parse(entry) {
            var p = FX.U.clone(entry.row.row), n, values = [], size = dimension(entry.row);
            if (entry.keepCurrent) {
                var r = model(entry);
                FX.U.assert(r && !r.unknownValues && r.values.length, 'Current values unavailable; enter a fixed value');
                p.value = FX.U.clone(r.values[0]);
                p.keepCurrent = true;
            } else if (p.control && p.control.kind === 'menu') {
                p.value = entry.menuValue;
            } else {
                for (n = 0; n < size; n++) {
                    FX.U.assert(/\S/.test(entry.texts[n] || ''), 'Enter every component for ' + entry.row.name);
                    values.push(Number(entry.texts[n]));
                }
                p.value = size === 1 ? values[0] : values;
            }
            FX.Validate.rows([p]);
            return p;
        }
        function displayDraft(entry) {
            if (entry.keepCurrent) { return 'Keep each current value'; }
            try { return FX.Parameters.display(parse(entry)); }
            catch (ignoredInvalid) { return entry.texts.join(', ') || 'Choose a value'; }
        }
        function save() { o.onDraftChange(FX.U.clone(drafts)); }
        function updateTitle(r) {
            title.text = 'No parameters match. Clear the search or change the filter.';
            if (r) {
                title.text = r.name;
                if (drafts[key(r)]) {
                    title.text += invalidDrafts[key(r)] ? ' - Invalid value' : ' - Pending change';
                }
            }
        }
        function refreshDrafts() {
            if (updatingDrafts) { return; }
            updatingDrafts = true;
            try {
                var k, item, entry, total = 0, r, applicable, invalid = {}, label;
                invalidDrafts = invalid;
                validationErrors = [];
                changes.removeAll();
                for (k in drafts) {
                    if (FX.U.own(drafts, k)) {
                        entry = drafts[k];
                        item = changes.add('item', entry.row.name);
                        item.fxDraftKey = k;
                        r = model(entry);
                        item.subItems[0].text = (r ? r.previous : 'Unavailable') + ' -> ' + displayDraft(entry);
                        item.helpTip = item.subItems[0].text;
                        item.subItems[1].text = 'Set all selected effects';
                        if (entry.removeKeyframes) {
                            item.subItems[1].text = entry.keepCurrent ? 'Clear keys; keep each value' : 'Remove keys + set all values';
                        }
                        total++;
                        try {
                            parse(entry);
                            applicable = r ? r.available : 0;
                            if (r && entry.removeKeyframes && r.canRemoveKeyframes) { applicable += r.removable; }
                            FX.U.assert(r && applicable === r.total,
                                r && r.removable && !entry.removeKeyframes ?
                                    'Remove keyframes for this parameter to update all selected effects, or clear this change.' :
                                    'Cannot update all selected effects. View targets, resolve protected/missing parameters or change the selection.');
                        }
                        catch (error) {
                            invalid[k] = true;
                            item.subItems[1].text = 'Invalid value - correct before Apply';
                            validationErrors.push(entry.row.name + ': ' + String(error.message || 'Invalid value'));
                        }
                    }
                }
                pendingTitle.text = total + ' pending parameter changes. Apply sends all of them in one batch.';
                show(pendingTitle, total > 0);
                show(changes, total > 0);
                validation.text = validationErrors.join('\n');
                show(validation, validationErrors.length > 0);
                for (var n = 0; n < list.items.length; n++) {
                    r = list.items[n].fxEditorRow;
                    entry = drafts[key(r)];
                    label = '';
                    if (entry) { label = invalid[key(r)] ? '! ' : '* '; }
                    label += r.name;
                    if (list.items[n].text !== label) { list.items[n].text = label; }
                    list.items[n].subItems[1].text = entry ? displayDraft(entry) : 'Keep original';
                    applicable = r.available;
                    if (entry && entry.removeKeyframes && r.canRemoveKeyframes) { applicable += r.removable; }
                    list.items[n].subItems[2].text = (entry && applicable < r.total ? 'Blocked ' : '') + applicable + '/' + r.total;
                }
                updateTitle(active);
                apply.enabled = total > 0 && validationErrors.length === 0;
            } finally { updatingDrafts = false; }
            layout();
        }
        function remember() {
            if (loading || !active || d.fxClosed) { return; }
            var texts = [], n, any = false, value = null;
            for (n = 0; n < dimension(active); n++) {
                texts.push(fields[n].text);
                if (/\S/.test(fields[n].text)) { any = true; }
            }
            if (isMenu(active)) {
                value = menu.selection ? menu.selection.fxValue : null;
                any = typeof value === 'number';
                if (!any) { value = null; }
            }
            if ((any || removeAnimation.value) && canEdit(active)) {
                drafts[key(active)] = {
                    row: { path: active.path, name: active.name, row: active.row },
                    texts: texts, menuValue: value,
                    removeKeyframes: !!removeAnimation.value && active.canRemoveKeyframes,
                    keepCurrent: !!removeAnimation.value && !any
                };
            } else { delete drafts[key(active)]; }
            save();
            refreshDrafts();
        }
        function load(r) {
            loading = true;
            active = r;
            var entry = r ? drafts[key(r)] : null, size = dimension(r), n, c, item;
            removeAnimation.value = !!(entry && entry.removeKeyframes);
            removeAnimation.enabled = !!r && r.canRemoveKeyframes;
            show(animationRow, !!r && r.removable > 0);
            updateTitle(r);
            current.text = '';
            if (r) {
                current.text = 'Current: ' + r.current + ' | ' + r.total + ' selected effects; Apply includes all.';
                if (r.removable) {
                    current.text += '\nKeyframes: ' + r.keyframes + ' in ' + r.removable + ' effects';
                    if (r.singleKeyEffects) { current.text += '; ' + r.singleKeyEffects + ' with a single keyframe'; }
                    current.text += '.';
                }
                if (r.guidance && (!r.safe || r.removable)) { current.text += '\n' + r.guidance; }
                o.onPathChange(r.path);
            }
            previousValues.text = r ? 'Previous values (effect counts): ' + r.previous : '';
            // Retain EditText dimensions when a search temporarily hides it.
            previousValues.visible = !!r;
            menu.removeAll();
            menu.add('item', 'Keep original values');
            menu.selection = 0;
            if (isMenu(r)) {
                for (n = 0; n < r.row.control.choices.length; n++) {
                    c = r.row.control.choices[n];
                    item = menu.add('item', c.label);
                    item.fxValue = c.value;
                    if (entry && entry.menuValue === c.value) { menu.selection = item; }
                }
            }
            menu.visible = isMenu(r);
            numberInputs.visible = !isMenu(r) && size > 0;
            menu.enabled = canEdit(r);
            for (n = 0; n < fields.length; n++) {
                fields[n].visible = !isMenu(r) && n < size;
                fields[n].enabled = canEdit(r);
                fields[n].text = entry && entry.texts[n] !== undefined ? entry.texts[n] : '';
            }
            fieldHint.text = 'Blank / Keep original leaves each existing value unchanged.';
            if (r && r.removable) { fieldHint.text = 'With Remove keyframes checked: blank keeps each current value; a new value replaces all selected values.'; }
            if (r && r.row && r.row.control && r.row.control.kind === 'number') {
                c = r.row.control;
                if (c.min !== undefined) { fieldHint.text += ' Min: ' + c.min + '.'; }
                if (c.max !== undefined) { fieldHint.text += ' Max: ' + c.max + '.'; }
                if (c.units) { fieldHint.text += ' Host units: ' + c.units + '.'; }
            }
            loading = false;
            layout();
        }
        function matches(r) {
            var text = (r.name + ' ' + r.current + ' ' + r.previous + ' ' + FX.Config.key(r.path)).toLowerCase(),
                terms = search.text.toLowerCase().split(/\s+/), n, f = filter.selection ? filter.selection.index : 0;
            for (n = 0; n < terms.length; n++) { if (terms[n] && text.indexOf(terms[n]) < 0) { return false; } }
            if (f === 1) { return r.safe; }
            if (f === 2) { return r.removable > 0; }
            if (f === 3) { return !!drafts[key(r)]; }
            if (f === 4) { return !r.safe; }
            return true;
        }
        function rebuildList() {
            if (filling || d.fxClosed) { return; }
            remember();
            filling = true;
            var wanted = active ? FX.Config.key(active.path) : FX.Config.key(o.lastPath || []), item, n, chosen = null;
            list.removeAll();
            visibleRows = [];
            for (n = 0; n < rows.length; n++) {
                if (matches(rows[n])) {
                    item = list.add('item', rows[n].name);
                    item.fxEditorRow = rows[n];
                    item.subItems[0].text = rows[n].current;
                    visibleRows.push(rows[n]);
                    if (FX.Config.key(rows[n].path) === wanted) { chosen = item; }
                }
            }
            count.text = visibleRows.length + '/' + rows.length + ' parameters shown';
            list.selection = chosen || list.items[0] || null;
            filling = false;
            load(list.selection ? list.selection.fxEditorRow : null);
            refreshDrafts();
        }
        function showTargets() {
            if (!active) { return; }
            var detail = o.createDialog('Parameter occurrences'), table = detail.add('listbox', undefined, [], {
                numberOfColumns: 5, showHeaders: true,
                columnTitles: ['Composition', 'Layer', 'Effect', 'Status', 'Previous value'], columnWidths: [90, 110, 120, 230, 130]
            }), n, entry, reason, item;
            detail.orientation = 'column';
            detail.alignChildren = 'fill';
            table.preferredSize = [680, 240];
            for (n = 0; n < o.instances.length; n++) {
                entry = FX.Presentation.parameterStatus(o.instances[n], active.path);
                reason = entry.reason;
                if (removeAnimation.value && entry.removable) { reason = 'Will remove ' + entry.keyCount + ' keyframes'; }
                if (active.row && entry.valueType && entry.valueType !== active.row.valueType) { reason = 'Blocked: incompatible value type'; }
                item = table.add('item', entry.target.compName);
                item.subItems[0].text = entry.target.layerName;
                item.subItems[1].text = entry.target.effectIndex + '. ' + FX.Presentation.effectName(entry.target);
                item.subItems[2].text = reason;
                item.subItems[3].text = entry.hasValue ? FX.Parameters.display({ control: entry.control }, entry.currentValue) : 'Unavailable';
            }
            o.button(detail, 'Close', function () { detail.close(0); });
            o.showDialog(detail);
        }
        function submit() {
            remember();
            if (validationErrors.length) { return; }
            var chosen = [], removePaths = [], k, entry;
            for (k in drafts) {
                if (FX.U.own(drafts, k)) {
                    entry = drafts[k];
                    chosen.push(parse(entry));
                    if (entry.removeKeyframes) { removePaths.push(entry.row.path); }
                }
            }
            FX.Validate.rows(chosen);
            result = { rows: chosen, removeKeyframes: removePaths,
                path: active ? active.path : o.lastPath };
            d.close(1);
        }
        search.onChanging = o.guard(rebuildList, 'parameter-search');
        filter.onChange = o.guard(rebuildList, 'parameter-filter');
        list.onChange = o.guard(function () {
            if (filling || loading || updatingDrafts) { return; }
            remember();
            load(list.selection ? list.selection.fxEditorRow : null);
        }, 'parameter-selection');
        for (i = 0; i < fields.length; i++) { fields[i].onChanging = fields[i].onChange = o.guard(remember, 'parameter-input'); }
        menu.onChange = o.guard(remember, 'parameter-menu');
        removeAnimation.onClick = o.guard(function () {
            remember();
            for (var n = 0; n < fields.length; n++) { fields[n].enabled = canEdit(active); }
            menu.enabled = canEdit(active);
        }, 'parameter-animation');
        changes.onChange = o.guard(function () {
            if (loading || updatingDrafts || !changes.selection) { return; }
            var selectedKey = changes.selection.fxDraftKey, n;
            remember();
            for (n = 0; n < rows.length; n++) {
                if (key(rows[n]) === selectedKey) {
                    search.text = '';
                    filling = true;
                    filter.selection = 0;
                    filling = false;
                    load(rows[n]);
                    rebuildList();
                    break;
                }
            }
        }, 'pending-selection');
        loading = false;
        show(searchRow, rows.length > 1);
        show(count, rows.length > 1);
        show(list, rows.length > 1);
        rebuildList();
        shown = true;
        d.onResizing = d.onResize = o.guard(function () { d.layout.resize(); }, 'editor-resize');
        return o.showDialog(d) === 1 ? result : null;
    }
    return { open: open };
})();

// MODULE: ui/panel.js
FX.UI = (function () {
    function start(host, settings) {
        settings = settings || {};
        var isPanel = typeof Panel !== 'undefined' && host instanceof Panel;
        var w = isPanel
            ? host
            : new Window('palette', 'FX Exchanger ' + FX.Updates.installed, undefined, {
                  resizeable: true
              });
        if (w.fxController) {
            w.fxController.dispose();
            w.remove(w.fxController.root);
        }
        w.orientation = 'column';
        w.alignChildren = ['fill', 'fill'];
        var shell = w.add('group');
        shell.orientation = 'column';
        shell.alignment = ['fill', 'fill'];
        shell.alignChildren = ['fill', 'top'];
        shell.margins = 0;
        shell.spacing = 4;
        var header = row(shell);
        var body = shell.add('group');
        body.alignment = ['fill', 'fill'];
        body.minimumSize = [180, 80];
        var viewport = body.add('panel', undefined, '');
        viewport.margins = 0;
        var scrollBar = body.add('scrollbar', undefined, 0, 0, 1);
        scrollBar.stepdelta = 24;
        scrollBar.jumpdelta = 120;
        var root = viewport.add('group');
        root.alignment = ['fill', 'fill'];
        root.orientation = 'column';
        root.alignChildren = ['fill', 'top'];
        root.spacing = 5;
        root.margins = 6;
        var diagnostics = new FX.Diagnostics(),
            adapter =
                settings.adapter || new FX.AfterEffectsAdapter(diagnostics),
            scanner = new FX.Scanner(adapter),
            batch = new FX.Batch(adapter, scanner);
        diagnostics = adapter.diagnostics;
        var store = null,
            state = FX.Model.state(),
            filters = {},
            manualIds = [],
            paths = [],
            selectedEffects = {},
            selectedLayers = {},
            view = { layers: [], instances: [] },
            groups = [],
            busy = false,
            lastReport = null,
            sourceRows = null,
            disposed = false,
            ticking = false,
            lastRender = null,
            activeTarget = null,
            adding = false,
            rendering = false,
            selecting = false,
            renderInProgress = false,
            renderPending = false,
            presentationFailed = false,
            sessionEpoch = 0,
            displayQuery = '',
            searchPending = false,
            page = 0,
            pageSize = 200,
            groupCache = [],
            renderedNodes = [],
            expansion = {},
            activeNodeKey = null,
            activeEffectKey = null,
            pageEffects = {},
            refreshTargets = null,
            pendingRestore = null,
            pendingParameterRefresh = null,
            dialogs = [],
            editorDraft = null,
            lastEditorPath = null,
            editorContinueRequest = null,
            editorContinueTask = null,
            startupFailed = false,
            layoutReady = false,
            layoutBusy = false,
            scrollOffset = 0,
            viewportState = null,
            advancedChoice = 0,
            lastValidGroup = 7,
            initializing = true,
            viewSyncing = false,
            viewChanging = false,
            advancedDialogOpen = false;
        var selectionAnchor = null,
            selectionGesture = 0,
            consumedGesture = -1,
            consumedKey = null,
            gestureModifiers = null;
        var parameterClipboard = null,
            presetLibrary = null,
            effectPreset = null;
        try {
            if (!settings.noStorage) {
                store = new FX.Store();
                state = store.load();
            }
        } catch (storageError) {
            store = null;
            startupFailed = true;
            reportError('preferences-load', storageError);
        }
        function dimension(control, key, index, fallback) {
            var n;
            try {
                n = control.size[key];
                if (typeof n !== 'number') {
                    n = control.size[index];
                }
                if (typeof n === 'number' && isFinite(n) && n > 0) {
                    return n;
                }
            } catch (ignoredSize) {}
            return fallback;
        }
        function layoutRow(control, width, height) {
            var items = [],
                i,
                c,
                flex = -1,
                x = 0,
                widths = [],
                weights = [],
                fixed = 0,
                gap = 4;
            for (i = 0; i < control.children.length; i++) {
                c = control.children[i];
                if (c.visible !== false) {
                    items.push(c);
                }
            }
            if (!items.length) {
                return;
            }
            if (height > 28 && items.length > 2) {
                var split = 2,
                    start = 0,
                    line,
                    end,
                    j;
                if (items.length === 3) {
                    split = 1;
                }
                for (line = 0; line < 2; line++) {
                    end = items.length;
                    if (line === 0) {
                        end = split;
                    }
                    widths = FX.Presentation.rowWidths(
                        width,
                        line === 0 && split === 1 ? [1] : [1, 1],
                        gap
                    );
                    x = 0;
                    for (j = start; j < end; j++) {
                        items[j].bounds = [
                            x,
                            line * 32,
                            x + widths[j - start],
                            line * 32 + 28
                        ];
                        x += widths[j - start] + gap;
                    }
                    start = split;
                }
                return;
            }
            for (i = 0; i < items.length; i++) {
                c = items[i];
                if (c.type === 'dropdownlist' || c.type === 'edittext') {
                    flex = i;
                }
                weights.push(1);
            }
            if (control === actionRow) {
                weights[0] = 2;
            }
            if (flex >= 0) {
                for (i = 0; i < items.length; i++) {
                    if (i === flex) {
                        continue;
                    }
                    widths[i] = items[i].type === 'statictext' ? 38 : 64;
                    fixed += widths[i];
                }
                widths[flex] = Math.max(
                    20,
                    width - fixed - gap * (items.length - 1)
                );
            } else {
                widths = FX.Presentation.rowWidths(width, weights, gap);
            }
            for (i = 0; i < items.length; i++) {
                items[i].bounds = [x, 0, x + widths[i], 28];
                x += widths[i] + gap;
            }
        }
        function layoutViewport(width, height) {
            if (!layoutReady || layoutBusy || disposed) {
                return;
            }
            layoutBusy = true;
            try {
                if (typeof width === 'number' && typeof height === 'number') {
                    body.size = [width, height];
                }
                width = dimension(body, 'width', 0, 440);
                height = dimension(body, 'height', 1, 580);
                var state = FX.Presentation.viewport(
                        width,
                        height,
                        pager.visible,
                        reportText.visible,
                        resultsButton.visible
                    ),
                    inner = state.width - 12,
                    y = 6,
                    fy = 0,
                    i,
                    fields = [sr, searchRow, gr, scanRow];
                viewportState = state;
                scrollOffset = Math.max(
                    0,
                    Math.min(scrollOffset, state.maxScroll)
                );
                viewport.bounds = [0, 0, state.width, height];
                root.bounds = [
                    0,
                    -scrollOffset,
                    state.width,
                    state.contentHeight - scrollOffset
                ];
                scrollBar.bounds = [width - 16, 0, width, height];
                scrollBar.visible = state.scrollbar;
                scrollBar.enabled = state.scrollbar;
                scrollBar.maxvalue = Math.max(1, state.maxScroll);
                scrollBar.value = scrollOffset;
                scrollBar.jumpdelta = Math.max(24, height - 28);
                for (i = 0; i < fields.length; i++) {
                    fields[i].bounds = [0, fy, inner, fy + 28];
                    layoutRow(fields[i], inner, 28);
                    fy += 32;
                }
                status.bounds = [0, fy, inner, fy + 38];
                fy += 42;
                tree.control.bounds = [0, fy, inner, fy + state.treeHeight];
                find.bounds = [6, y, 6 + inner, y + fy + state.treeHeight];
                y += fy + state.treeHeight + 5;
                if (pager.visible) {
                    pager.bounds = [6, y, 6 + inner, y + 28];
                    layoutRow(pager, inner, 28);
                    y += 33;
                }
                summary.bounds = [6, y, 6 + inner, y + 34];
                y += 39;
                selectionRow.bounds = [6, y, 6 + inner, y + 28];
                layoutRow(selectionRow, inner, 28);
                y += 33;
                actionRow.bounds = [6, y, 6 + inner, y + state.actionHeight];
                layoutRow(actionRow, inner, state.actionHeight);
                y += state.actionHeight + 5;
                directRow.bounds = [6, y, 6 + inner, y + state.directHeight];
                layoutRow(directRow, inner, state.directHeight);
                y += state.directHeight + 5;
                if (reportText.visible) {
                    reportText.bounds = [6, y, 6 + inner, y + 70];
                }
                state.offset = scrollOffset;
            } finally {
                layoutBusy = false;
            }
        }
        function scrollTo(value) {
            if (
                disposed ||
                layoutBusy ||
                !viewportState ||
                typeof value !== 'number' ||
                !isFinite(value)
            ) {
                return;
            }
            layoutBusy = true;
            try {
                scrollOffset = Math.max(
                    0,
                    Math.min(value, viewportState.maxScroll)
                );
                scrollBar.value = scrollOffset;
                root.bounds = [
                    0,
                    -scrollOffset,
                    viewportState.width,
                    viewportState.contentHeight - scrollOffset
                ];
                viewportState.offset = scrollOffset;
            } finally {
                layoutBusy = false;
            }
        }
        function wheel(event) {
            if (
                disposed ||
                !viewportState ||
                !viewportState.scrollbar ||
                event.target === tree.control
            ) {
                return;
            }
            var step = FX.Presentation.wheelStep(event),
                before = scrollOffset;
            if (!step) {
                return;
            }
            scrollTo(scrollOffset + step);
            if (before !== scrollOffset) {
                if (event.preventDefault) {
                    event.preventDefault();
                }
                if (event.stopPropagation) {
                    event.stopPropagation();
                }
            }
        }
        scrollBar.helpTip =
            'Scroll panel controls. The results list scrolls independently. Native wheel delivery depends on the host.';
        scrollBar.onChanging = scrollBar.onChange = guard(function () {
            scrollTo(scrollBar.value);
        }, 'scroll');
        try {
            body.addEventListener('mousewheel', guard(wheel, 'wheel'), true);
        } catch (ignoredMouseWheel) {}
        try {
            body.addEventListener('wheel', guard(wheel, 'wheel'), true);
        } catch (ignoredWheel) {}
        body.addEventListener(
            'keydown',
            guard(function (event) {
                if (
                    event.target === tree.control ||
                    (event.target && event.target.type === 'edittext')
                ) {
                    return;
                }
                if (
                    event.keyName === 'Page_Down' ||
                    event.keyName === 'PageDown'
                ) {
                    scrollTo(scrollOffset + viewportState.height - 28);
                } else if (
                    event.keyName === 'Page_Up' ||
                    event.keyName === 'PageUp'
                ) {
                    scrollTo(scrollOffset - viewportState.height + 28);
                } else {
                    return;
                }
                if (event.preventDefault) {
                    event.preventDefault();
                }
            }, 'scroll-key')
        );
        function row(parent) {
            var g = parent.add('group');
            g.orientation = 'row';
            g.alignChildren = ['fill', 'center'];
            g.spacing = 4;
            return g;
        }
        function button(parent, title, fn) {
            var properties = {};
            if (title === 'Cancel' || title === 'Close') {
                properties.name = 'cancel';
            }
            if (title === 'Apply') {
                properties.name = 'ok';
            }
            var b = parent.add('button', undefined, title, properties);
            b.preferredSize.width = Math.max(
                43,
                Math.min(175, title.length * 6 + 16)
            );
            b.onClick = guard(fn, title);
            return b;
        }
        function closeDialogs() {
            var i;
            for (i = dialogs.length - 1; i >= 0; i--) {
                try {
                    dialogs[i].close(0);
                } catch (ignoredClose) {}
            }
        }
        function bindDialogEvents(control, dialog) {
            var names = ['onClick', 'onChange', 'onChanging'],
                i;
            function bind(fn, name) {
                var protectedCallback = guard(fn, 'dialog/' + name);
                return function () {
                    if (disposed || dialog.fxClosed) {
                        return;
                    }
                    return protectedCallback.apply(this, arguments);
                };
            }
            for (i = 0; i < names.length; i++) {
                if (typeof control[names[i]] === 'function') {
                    control[names[i]] = bind(control[names[i]], names[i]);
                }
            }
            for (i = 0; control.children && i < control.children.length; i++) {
                bindDialogEvents(control.children[i], dialog);
            }
        }
        function showDialog(d) {
            if (disposed || initializing) {
                return 0;
            }
            var previousClose = d.onClose,
                result;
            d.fxClosed = false;
            d.onClose = function () {
                d.fxClosed = true;
                if (previousClose) {
                    return previousClose();
                }
                return true;
            };
            dialogs.push(d);
            try {
                bindDialogEvents(d, d);
                d.layout.layout(true);
                d.center();
                result = d.show();
                return result;
            } finally {
                if (!d.fxClosed) {
                    try {
                        d.close(0);
                    } catch (ignoredClose) {}
                }
                dialogs.pop();
                if (!dialogs.length && renderPending && !disposed) {
                    renderPending = false;
                    render();
                }
            }
        }
        function dropdown(parent, items) {
            var d = parent.add('dropdownlist', undefined, items);
            d.alignment = ['fill', 'center'];
            d.preferredSize.width = 160;
            d.selection = 0;
            return d;
        }
        function reportError(operation, error) {
            // Every sink is independently guarded; never mask the original exception.
            var started = 0;
            try {
                started = FX.U.now();
            } catch (ignoredClock) {}
            try {
                diagnostics.error(operation, error);
            } catch (ignoredDiagnostic) {}
            try {
                if (!scanner.job && !batch.executing) {
                    busy = false;
                    scanButton.enabled = true;
                    cancelButton.enabled = false;
                }
                if (scanner.basic && scanner.basic.stale) {
                    updateActions();
                }
            } catch (ignoredRecoveryControls) {}
            try {
                status.text =
                    'Error - ' +
                    operation +
                    ' stopped. See Help > Diagnostics; retry explicitly.';
            } catch (ignoredStatus) {}
            try {
                diagnostics.measure('errorRecovery', FX.U.now() - started, 1);
            } catch (ignoredMetric) {}
        }
        function guard(fn, operation) {
            return function () {
                if (disposed) {
                    return;
                }
                try {
                    return fn.apply(this, arguments);
                } catch (error) {
                    closeDialogs();
                    reportError(operation || 'ui-callback', error);
                }
            };
        }
        function save() {
            if (store) {
                try {
                    store.save(state);
                } catch (e) {
                    reportError('preferences-save', e);
                }
            }
        }
        header.add('statictext', undefined, 'FX Exchanger');
        var headerSpace = header.add('group');
        headerSpace.alignment = ['fill', 'center'];
        headerSpace.minimumSize = [0, 0];
        var helpButton = button(header, 'Help', helpDialog);
        helpButton.alignment = ['right', 'center'];
        helpButton.helpTip =
            'Help and Diagnostics (version is available there).';
        var find = root.add('group');
        find.alignment = ['fill', 'fill'];
        find.orientation = 'column';
        find.alignChildren = ['fill', 'top'];
        find.spacing = 4;
        find.margins = 0;
        var sr = row(find);
        sr.add('statictext', undefined, 'Scope');
        var scope = dropdown(sr, [
            'Active Composition',
            'Choose Compositions',
            'Entire Project'
        ]);
        var scopes = ['active', 'manual', 'entire'],
            modes = [
                'type-config',
                'effect',
                'type',
                'config',
                'selected',
                'composition',
                'layers',
                'occurrences'
            ];
        var choose = button(sr, 'Choose...', function () {
            var comps = adapter.compositions(),
                d = new Window('dialog', 'Choose compositions');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var query = d.add('edittext', undefined, ''),
                list = d.add('listbox', undefined, [], { multiselect: true }),
                count = d.add('statictext', undefined, ''),
                chosen = {},
                i;
            query.helpTip =
                'Find compositions by name; selections hidden by search are preserved.';
            list.preferredSize = [360, 240];
            for (i = 0; i < manualIds.length; i++) {
                chosen['$' + manualIds[i]] = true;
            }
            function remember() {
                var j;
                for (j = 0; j < list.items.length; j++) {
                    chosen['$' + list.items[j].compId] = list.items[j].selected;
                }
                updateCount();
            }
            function updateCount() {
                var j,
                    n = 0;
                for (j = 0; j < comps.length; j++) {
                    if (chosen['$' + comps[j].id]) {
                        n++;
                    }
                }
                count.text = n + ' composition(s) selected';
            }
            function fill() {
                list.removeAll();
                var j, item;
                for (j = 0; j < comps.length; j++) {
                    if (FX.Filters.text(comps[j].name, query.text)) {
                        item = list.add(
                            'item',
                            comps[j].name + ' [ID ' + comps[j].id + ']'
                        );
                        item.compId = comps[j].id;
                        item.selected = !!chosen['$' + item.compId];
                    }
                }
                updateCount();
            }
            query.onChanging = function () {
                remember();
                fill();
            };
            list.onChange = remember;
            var r = row(d);
            button(r, 'Select All', function () {
                var j;
                for (j = 0; j < list.items.length; j++) {
                    list.items[j].selected = true;
                }
                remember();
            });
            button(r, 'Clear Selection', function () {
                chosen = {};
                fill();
            });
            button(r, 'Cancel', function () {
                d.close(0);
            });
            button(r, 'Use selection', function () {
                remember();
                var ids = [],
                    j;
                for (j = 0; j < comps.length; j++) {
                    if (chosen['$' + comps[j].id]) {
                        ids.push(comps[j].id);
                    }
                }
                FX.U.assert(ids.length, 'Choose at least one composition.');
                if (
                    manualIds.length &&
                    FX.JSON.stringify(ids) !== FX.JSON.stringify(manualIds) &&
                    !confirm(
                        'Replace the previous composition selection with ' +
                            ids.length +
                            ' composition(s)?'
                    )
                ) {
                    return;
                }
                manualIds = ids;
                d.close(1);
            });
            fill();
            if (showDialog(d) === 1) {
                scope.selection = 1;
                invalidateScope();
            }
        });
        var searchRow = row(find);
        searchRow.add('statictext', undefined, 'Find');
        var search = searchRow.add('edittext', undefined, '');
        search.helpTip =
            'Search or Enter inventories the scope if needed, then filters in memory. Initial parameter reads are explicit; successful parameter edits update the same selection automatically.';
        search.characters = 10;
        search.alignment = ['fill', 'center'];
        search.minimumSize.width = 50;
        var searchButton = button(searchRow, 'Search', searchProject);
        button(searchRow, 'Clear', function () {
            search.text = '';
            applySearch();
        });
        var gr = row(find);
        gr.add('statictext', undefined, 'View');
        var groupBy = dropdown(gr, [
            'Configuration groups (advanced)',
            'Effect groups',
            'Effect and layer type groups',
            'Full configuration groups',
            'Selected parameter groups',
            'Composition and configuration groups',
            'Layers (including without effects)',
            'Effects (individual instances)'
        ]);
        groupBy.visible = false;
        groupBy.maximumSize = [0, 0];
        var mainView = dropdown(gr, ['Effects', 'Groups', 'Layer']);
        mainView.helpTip =
            'Groups compares configurations after Read Parameters. Layer includes empty layers. Configure grouping in More > Grouping...';
        var parameterGroup = button(gr, 'Parameters...', function () {
            chooseGrouping();
        });
        var presetsButton = button(gr, 'Presets...', presetDialog);
        var scanRow = row(find);
        button(scanRow, 'Filters...', filterDialog);
        var scanButton = button(scanRow, 'Scan', function () {
                runScan(scanner.basic && scanner.basic.stale);
            }),
            cancelButton = button(scanRow, 'Cancel', function () {
                cancelEditorContinuation();
                var updatingAfterEdit = !!pendingParameterRefresh ||
                    !!(pendingRestore && pendingRestore.readParameters);
                sessionEpoch++;
                pendingParameterRefresh = null;
                pendingRestore = null;
                scanner.cancel();
                busy = false;
                scanButton.enabled = true;
                cancelButton.enabled = false;
                render();
                updateActions();
                status.text =
                    'Cancelled - inventory preserved when available. Select effects to analyze.';
                if (updatingAfterEdit) {
                    status.text = 'Changes were applied. Updating was cancelled; review Results and refresh/read parameters to continue.';
                }
            });
        scanButton.helpTip =
            'Basic Scan only: existing effect identities, no property values.';
        groupBy.helpTip =
            'Effects lists individual instances. Layers includes empty layers. Other options are optional groups; changing View never reads parameters.';
        cancelButton.helpTip =
            'Cancel queued work without publishing partial configurations.';
        cancelButton.enabled = false;
        var status = find.add(
            'statictext',
            undefined,
            'Choose a scope, then Search or Scan. Parameters are read only on request.',
            { multiline: true }
        );
        status.preferredSize.height = 38;
        var tree = new FX.Results(find);
        tree.control.alignment = ['fill', 'fill'];
        tree.control.preferredSize = [300, 230];
        tree.control.minimumSize = [180, 90];
        tree.control.helpTip =
            'Selected results are highlighted. Ctrl toggles; Shift selects a range. Double-click a group, or use Left/Right, to collapse/expand.';
        tree.onExpand = guard(function () {
            refreshMarks(tree);
        }, 'results-expand');
        var nativeResultChange = tree.control.onChange;
        tree.control.onChange = guard(function () {
            try {
                nativeResultChange();
            } catch (selectionError) {
                lastRender = null;
                presentationFailed = true;
                tree.control.enabled = false;
                updateActions();
                throw selectionError;
            }
        }, 'result-native-selection');
        function selectionModifiers(event) {
            var keys = {};
            try {
                if (typeof ScriptUI !== 'undefined') {
                    keys = ScriptUI.environment.keyboardState;
                }
            } catch (ignoredKeys) {}
            return {
                ctrl: !!(
                    (event && (event.ctrlKey || event.metaKey)) ||
                    keys.ctrlKey ||
                    keys.metaKey
                ),
                shift: !!((event && event.shiftKey) || keys.shiftKey)
            };
        }
        function markSelection(data, flag) {
            var i;
            for (i = 0; i < data.instances.length; i++) {
                selectedEffects['$' + FX.Model.effectKey(data.instances[i])] =
                    flag;
            }
            for (i = 0; i < data.layers.length; i++) {
                selectedLayers['$' + FX.Model.layerKey(data.layers[i])] = flag;
            }
        }
        function selectionMark(data) {
            var count = 0,
                total = data.instances.length + data.layers.length,
                i;
            for (i = 0; i < data.instances.length; i++) {
                if (
                    selectedEffects['$' + FX.Model.effectKey(data.instances[i])]
                ) {
                    count++;
                }
            }
            for (i = 0; i < data.layers.length; i++) {
                if (selectedLayers['$' + FX.Model.layerKey(data.layers[i])]) {
                    count++;
                }
            }
            if (count === total && total) {
                return '[x] ';
            }
            if (count) {
                return '[-] ';
            }
            return '[ ] ';
        }
        function selectTreeItem(event) {
            if (
                busy ||
                renderInProgress ||
                dialogs.length ||
                rendering ||
                selecting
            ) {
                return;
            }
            var item = tree.selection,
                key,
                i,
                data,
                modifiers = gestureModifiers || selectionModifiers(event);
            if (!item || !item.fxData) {
                return;
            }
            if (
                !searchPending &&
                !adding &&
                consumedGesture === selectionGesture &&
                consumedKey === item.fxNodeKey
            ) {
                return;
            }
            selecting = true;
            try {
                key = item.fxNodeKey;
                if (searchPending) {
                    if (!applySearch()) {
                        return;
                    }
                    item = null;
                    for (i = 0; i < renderedNodes.length; i++) {
                        if (renderedNodes[i].fxNodeKey === key) {
                            item = renderedNodes[i];
                            break;
                        }
                    }
                    if (!item) {
                        clearSelection();
                        status.text =
                            'Search applied. Select a matching result.';
                        return;
                    }
                    tree.selection = item;
                }
                data = item.fxData;
                activeTarget = data;
                activeNodeKey = item.fxNodeKey;
                activeEffectKey =
                    data.instances.length === 1
                        ? FX.Model.effectKey(data.instances[0])
                        : null;
                if (!adding && !modifiers.ctrl) {
                    selectedEffects = {};
                    selectedLayers = {};
                }
                var anchor = -1,
                    end = -1,
                    start,
                    row,
                    parent,
                    visible;
                if (modifiers.shift && selectionAnchor) {
                    for (i = 0; i < renderedNodes.length; i++) {
                        if (renderedNodes[i].fxNodeKey === selectionAnchor) {
                            anchor = i;
                        }
                        if (renderedNodes[i] === item) {
                            end = i;
                        }
                    }
                }
                if (anchor >= 0 && end >= 0) {
                    start = Math.min(anchor, end);
                    end = Math.max(anchor, end);
                    for (i = start; i <= end; i++) {
                        row = renderedNodes[i];
                        visible = true;
                        parent = row.fxParentNode;
                        while (parent) {
                            if (parent.expanded === false) {
                                visible = false;
                                break;
                            }
                            parent = parent.fxParentNode;
                        }
                        if (
                            visible &&
                            ((item.fxLeaf && row.fxLeaf) ||
                                (!item.fxLeaf &&
                                    row.fxDepth === item.fxDepth &&
                                    !row.fxLeaf))
                        ) {
                            markSelection(row.fxData, true);
                        }
                    }
                } else {
                    markSelection(
                        data,
                        modifiers.ctrl ? selectionMark(data) !== '[x] ' : true
                    );
                    selectionAnchor = item.fxNodeKey;
                    tree.anchor = item;
                }
                consumedKey = item.fxNodeKey;
                consumedGesture = selectionGesture;
                adding = false;
                refreshMarks(tree);
                updateActions();
            } finally {
                selecting = false;
            }
        }
        tree.onChange = guard(selectTreeItem, 'result-selection');
        tree.addEventListener(
            'mousedown',
            guard(function (event) {
                selectionGesture++;
                gestureModifiers = selectionModifiers(event);
            }, 'selection-gesture'),
            true
        );
        tree.addEventListener(
            'keydown',
            guard(function (event) {
                if (
                    /^(Up|Down|Left|Right|Home|End|PageUp|PageDown|Page_Up|Page_Down)$/.test(
                        event.keyName || ''
                    )
                ) {
                    selectionGesture++;
                }
                gestureModifiers = selectionModifiers(event);
            }, 'selection-key'),
            true
        );
        tree.addEventListener(
            'click',
            guard(function (event) {
                try {
                    selectTreeItem(event);
                } finally {
                    gestureModifiers = null;
                }
            }, 'result-click')
        );
        var pager = row(root),
            previousPage = button(pager, 'Previous', function () {
                page = Math.max(0, page - 1);
                lastRender = null;
                render();
            }),
            pageText = pager.add('statictext', undefined, ''),
            nextPage = button(pager, 'Next', function () {
                page++;
                lastRender = null;
                render();
            });
        pager.visible = false;
        pager.maximumSize.height = 0;
        var summary = root.add('statictext', undefined, '0 effects selected', {
            multiline: true
        });
        summary.preferredSize.height = 34;
        var selectionRow = row(root);
        var selectResultsButton = button(
            selectionRow,
            'Select Results',
            function () {
                if (searchPending && !applySearch()) {
                    return;
                }
                setAll(true);
            }
        );
        button(selectionRow, 'Clear Selection', clearSelection);
        var actionRow = row(root);
        var primaryButton = button(actionRow, 'Scan', primaryAction);
        var locateButton = button(actionRow, 'Locate', locateSelection);
        var directRow = row(root);
        var enableButton = button(directRow, 'Enable', function () {
            confirmAndExecute(selected().instances, 'enable', {});
        });
        var disableButton = button(directRow, 'Disable', function () {
            confirmAndExecute(selected().instances, 'disable', {});
        });
        var addButton = button(directRow, 'Add Effect...', function () {
            var targets = selected().layers;
            FX.U.assert(
                targets.length,
                'Select an effect occurrence or switch View to Layers.'
            );
            effectMatchName = '';
            effectPreset = null;
            chooseEffect();
            if (effectMatchName) {
                confirmAndExecute(targets, 'apply', {
                    matchName: effectMatchName,
                    displayName: effectDisplayName,
                    rows: effectPreset ? effectPreset.rows : null,
                    presetName: effectPreset ? effectPreset.name : ''
                });
            }
        });
        var actionsButton = button(directRow, 'More...', actionsDialog);
        var resultsButton = button(actionRow, 'Results...', issuesDialog);
        resultsButton.enabled = false;
        var reportText = root.add('statictext', undefined, '', {
            multiline: true
        });
        reportText.preferredSize.height = 70;
        reportText.visible = false;
        reportText.maximumSize.height = 0;
        var effectMatchName = '',
            effectDisplayName = '';
        function analyzeSelection() {
            if (disposed || busy || renderInProgress || dialogs.length) {
                return;
            }
            var chosen = selected().instances,
                targets = [],
                ti;
            for (ti = 0; ti < chosen.length; ti++) {
                if (!chosen[ti].configuration) {
                    targets.push(chosen[ti]);
                }
            }
            if (!targets.length) {
                updateActions();
                return;
            }
            FX.U.assert(
                targets.length,
                'Select an effect or group to continue.'
            );
            scanner.analyze(currentFilters(), targets);
            sessionEpoch++;
            beginWork();
        }
        function primaryAction() {
            if (presentationFailed) {
                render();
                return;
            }
            var choice = FX.Presentation.selectionState(
                selected(),
                scanner.basic && !scanner.basic.stale
            );
            if (choice.action === 'scan') {
                runScan(true);
            } else if (choice.action === 'analyze') {
                if (choice.same) { requestEditorContinuation(selected().instances); }
                analyzeSelection();
            } else if (choice.action === 'edit') {
                editParameters();
            }
        }
        function clearSelection() {
            cancelEditorContinuation();
            selectionAnchor = null;
            tree.anchor = null;
            consumedKey = null;
            selectedEffects = {};
            selectedLayers = {};
            activeTarget = null;
            activeEffectKey = null;
            adding = false;
            rendering = true;
            tree.selection = null;
            rendering = false;
            refreshMarks(tree);
            updateActions();
        }
        function selectionDialog() {
            var d = new Window('dialog', 'Operation selection');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                'These actions affect visible results only.'
            );
            button(d, 'Select All', function () {
                setAll(true);
                d.close(1);
            });
            button(d, 'Clear Selection', function () {
                clearSelection();
                d.close(1);
            });
            button(d, 'Invert Selection', function () {
                setAll(null);
                d.close(1);
            });
            button(d, 'Remove highlighted', function () {
                toggleNode(false);
                d.close(1);
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function helpDialog() {
            var d = new Window('dialog', 'FX Exchanger Help');
            var installedVersion = FX.Updates.installed;
            d.add('statictext', undefined, 'FX Exchanger ' + installedVersion);
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var index = dropdown(d, []),
                i;
            for (i = 0; i < FX.Presentation.help.length; i++) {
                index.add('item', FX.Presentation.help[i][0]);
            }
            var text = d.add('edittext', undefined, '', {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [440, 300];
            index.onChange = function () {
                if (index.selection) {
                    text.text = FX.Presentation.help[index.selection.index][1];
                }
            };
            index.selection = 0;
            index.onChange();
            var updateStatus = d.add('statictext', undefined,
                'Check GitHub for a newer version. Only runs when you click Check for updates.', { multiline: true });
            updateStatus.preferredSize = [440, 42];
            updateStatus.fxUpdateStatus = true;
            var updateActions = row(d), checkingUpdates = false,
                checkUpdates = button(updateActions, 'Check for updates', function () {
                    if (checkingUpdates || disposed) { return; }
                    checkingUpdates = true;
                    checkUpdates.enabled = false;
                    updateStatus.text = 'Checking GitHub...';
                    try {
                        d.update();
                    } catch (ignoredUpdatePaint) {}
                    try {
                        var release = adapter.checkForUpdates(installedVersion);
                        if (release.unpublished) {
                            updateStatus.text = 'No published release is available yet. Installed: ' + installedVersion + '.';
                        } else if (release.available) {
                            updateStatus.text = 'Update available: ' + release.version + ' (installed: ' + installedVersion + '). Open Releases to download it.';
                        } else {
                            updateStatus.text = 'You are up to date. Installed: ' + installedVersion + '; latest release: ' + release.version + '.';
                        }
                    } catch (updateError) {
                        updateStatus.text = 'Could not check for updates. Check your connection or open Releases in your browser.';
                        diagnostics.error('check-updates', updateError);
                    } finally {
                        checkingUpdates = false;
                        checkUpdates.enabled = true;
                    }
                });
            button(updateActions, 'Open Releases', function () {
                try { adapter.openReleases(); }
                catch (browserError) { updateStatus.text = 'Open https://github.com/datacg/fxhx/releases in your browser.'; }
            });
            var openDiagnostics = false;
            button(d, 'Diagnostics...', function () {
                openDiagnostics = true;
                d.close(1);
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
            if (openDiagnostics) {
                diagnosticDialog();
            }
        }
        function locateSelection() {
            var scan = scanner.current(),
                records = selected().layers,
                n = tree.selection;
            if (!records.length && n && n.fxData) {
                records = n.fxData.instances.concat(n.fxData.layers);
            }
            FX.U.assert(records.length, 'Highlight or select a result first.');
            var comps = [],
                seen = {},
                i,
                chosen = records[0].compId;
            for (i = 0; i < records.length; i++) {
                if (!seen['$' + records[i].compId]) {
                    seen['$' + records[i].compId] = true;
                    comps.push(records[i]);
                }
            }
            if (comps.length > 1) {
                var d = new Window('dialog', 'Choose Timeline composition');
                d.orientation = 'column';
                d.alignChildren = 'fill';
                d.add(
                    'statictext',
                    undefined,
                    'Only the chosen composition Timeline will be selected.'
                );
                var list = dropdown(d, []);
                for (i = 0; i < comps.length; i++) {
                    list.add(
                        'item',
                        comps[i].compName + ' [ID ' + comps[i].compId + ']'
                    );
                }
                list.selection = 0;
                button(d, 'Locate', function () {
                    chosen = comps[list.selection.index].compId;
                    d.close(1);
                });
                button(d, 'Cancel', function () {
                    d.close(0);
                });
                if (showDialog(d) !== 1) {
                    return;
                }
            }
            var targets = [],
                done = {},
                key,
                j;
            try {
                for (i = 0; i < records.length; i++) {
                    if (records[i].compId !== chosen) {
                        continue;
                    }
                    key = '$' + FX.Model.layerKey(records[i]);
                    if (done[key]) {
                        continue;
                    }
                    for (j = 0; j < scan.layers.length; j++) {
                        if (
                            FX.Model.layerKey(scan.layers[j]) ===
                            FX.Model.layerKey(records[i])
                        ) {
                            adapter.validateLayer(scan.layers[j], true);
                        }
                    }
                    done[key] = true;
                    targets.push(records[i]);
                }
                adapter.selectLayers(targets);
                if (targets.length === 1 && targets[0].effectIndex) {
                    adapter.locate(targets[0]);
                }
                status.text =
                    'Located ' +
                    targets.length +
                    ' layers in ' +
                    targets[0].compName +
                    ' only.';
            } catch (error) {
                scanner.invalidate();
                throw error;
            }
        }
        function comparableInstances() {
            var chosen = selected().instances,
                match = chosen.length ? chosen[0].matchName : null,
                out = [],
                i;
            for (i = 0; i < view.instances.length; i++) {
                if (!match && view.instances[i].configuration) {
                    match = view.instances[i].matchName;
                }
                if (
                    view.instances[i].configuration &&
                    (!match || view.instances[i].matchName === match)
                ) {
                    out.push(view.instances[i]);
                }
            }
            return out;
        }
        function detailsDialog() {
            var n = tree.selection,
                s = selected().instances,
                e;
            if (n && n.fxData && n.fxData.instances.length) {
                e = n.fxData.instances[0];
            } else if (s.length) {
                e = s[0];
            }
            FX.U.assert(e, 'Highlight an effect occurrence first.');
            var d = new Window('dialog', 'Effect details');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var data =
                'Instance: ' +
                FX.Presentation.effectName(e) +
                '\nmatchName: ' +
                e.matchName +
                '\nComposition: ' +
                e.compName +
                ' [ID ' +
                e.compId +
                ']\nLayer: ' +
                e.layerName +
                '\nEffect index: ' +
                e.effectIndex +
                '\nEnabled: ' +
                e.enabled +
                '\nAnalysis: ' +
                e.analysisState;
            if (e.fingerprint) {
                data +=
                    '\nCanonical hash: ' +
                    e.fingerprint.hash +
                    '\nComparable: ' +
                    e.fingerprint.comparable +
                    '\nUnsupported: ' +
                    e.fingerprint.unsupported;
            }
            var text = d.add('edittext', undefined, data, {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [420, 260];
            button(d, 'Look up registered name', function () {
                var all = adapter.inventory(),
                    i;
                for (i = 0; i < all.length; i++) {
                    if (all[i].matchName === e.matchName) {
                        text.text =
                            data + '\nRegistered name: ' + all[i].displayName;
                        return;
                    }
                }
                text.text = data + '\nRegistered name unavailable.';
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function animationDialog() {
            var targets = selected().instances,
                scan = scanner.current(),
                i,
                j;
            FX.U.assert(
                targets.length > 0 && targets.length <= 2,
                'Select one occurrence to inspect, or two of the same effect to compare.'
            );
            for (i = 0; i < targets.length; i++) {
                FX.U.assert(
                    targets[i].configuration &&
                        targets[i].matchName === targets[0].matchName,
                    'Analyze selected occurrences of the same effect first.'
                );
            }
            var states = targets[0].configuration.states || [],
                d = new Window('dialog', 'Animation Inspection');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                'Read only: choose property paths, then Inspect Selected. No keyframe writes.'
            );
            var list = d.add('listbox', undefined, [], { multiselect: true });
            list.preferredSize = [460, 110];
            for (i = 0; i < states.length; i++) {
                list.add(
                    'item',
                    (states[i].name ||
                        states[i].path[states[i].path.length - 1].matchName) +
                        ' / ' +
                        states[i].state
                );
            }
            var keyTable = d.add('listbox', undefined, [], {
                numberOfColumns: 4,
                showHeaders: true,
                columnTitles: ['Key', 'Time (s)', 'Value', 'Curve'],
                columnWidths: [55, 85, 170, 150]
            });
            keyTable.preferredSize = [460, 150];
            var text = d.add(
                'edittext',
                undefined,
                'No detailed keyframes read yet.',
                { multiline: true, scrolling: true, readonly: true }
            );
            text.preferredSize = [460, 130];
            keyTable.onChange = function () {
                if (keyTable.selection) {
                    text.text = FX.JSON.stringify(
                        keyTable.selection.fxKeyMetadata
                    );
                }
            };
            button(d, 'Inspect Selected', function () {
                scanner.current();
                keyTable.removeAll();
                var paths = [],
                    captures = [],
                    lines = [],
                    t,
                    layer = null,
                    s,
                    n,
                    key;
                for (s = 0; s < list.items.length; s++) {
                    if (list.items[s].selected) {
                        paths.push(states[s].path);
                    }
                }
                FX.U.assert(
                    paths.length > 0 && paths.length <= 16,
                    'Choose 1 to 16 paths for this inspection.'
                );
                for (t = 0; t < targets.length; t++) {
                    layer = null;
                    for (s = 0; s < scan.layers.length; s++) {
                        if (
                            FX.Model.layerKey(scan.layers[s]) ===
                            FX.Model.layerKey(targets[t])
                        ) {
                            layer = scan.layers[s];
                        }
                    }
                    captures.push(
                        adapter.inspectAnimation(targets[t], paths, layer)
                    );
                    lines.push(
                        (t === 0 ? 'A: ' : 'B: ') +
                            targets[t].compName +
                            ' / ' +
                            targets[t].layerName +
                            ' / #' +
                            targets[t].effectIndex
                    );
                    for (s = 0; s < captures[t].length; s++) {
                        var item = captures[t][s];
                        lines.push(
                            'Property: ' +
                                item.path[item.path.length - 1].matchName +
                                ' / ' +
                                item.data.state +
                                ' / keyframes: ' +
                                item.data.keyCount
                        );
                        if (item.data.expression) {
                            lines.push(
                                'Expression (enabled ' +
                                    item.data.expressionEnabled +
                                    '):\n' +
                                    item.data.expression
                            );
                        }
                        for (n = 0; n < item.data.keys.length; n++) {
                            key = item.data.keys[n];
                            var keyRow = keyTable.add(
                                'item',
                                (t === 0 ? 'A #' : 'B #') + key.index
                            );
                            keyRow.subItems[0].text = String(key.time);
                            keyRow.subItems[1].text = FX.Presentation.value(
                                key.value
                            );
                            keyRow.subItems[2].text = key.curve;
                            keyRow.fxKeyMetadata = key;
                            lines.push(
                                'Key ' +
                                    key.index +
                                    ' @ ' +
                                    key.time +
                                    ': ' +
                                    key.curve +
                                    '\n' +
                                    FX.JSON.stringify(key)
                            );
                        }
                        if (!item.complete) {
                            lines.push('Partial: ' + item.reasons.join(', '));
                        }
                    }
                }
                if (captures.length === 2) {
                    for (s = 0; s < paths.length; s++) {
                        lines.push(
                            'A/B ' +
                                paths[s][paths[s].length - 1].matchName +
                                ': ' +
                                FX.Animation.compare(
                                    captures[0][s],
                                    captures[1][s]
                                ).status
                        );
                    }
                }
                lines.push(
                    'Easy Ease-like labels recognize a numeric pattern; they do not prove the command used or rendered equivalence.'
                );
                text.text = lines.join('\n\n');
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function editParameters() {
            cancelEditorContinuation();
            scanner.current();
            var s = selected(), instances = s.instances,
                rows = FX.Presentation.editRows(instances), ids = [], i,
                draftKey = scanner.basic.id + '/' + scanner.analysisRevision,
                choice = FX.Presentation.selectionState(s, true), intent, execution;
            FX.U.assert(choice.action === 'edit', choice.message);
            FX.U.assert(rows.length, 'No public parameters are available for this selection.');
            for (i = 0; i < instances.length; i++) { ids.push(FX.Model.effectKey(instances[i])); }
            ids.sort();
            draftKey += '/' + ids.join('|');
            intent = FX.Editor.open({
                dialog: new Window('dialog', 'Edit Parameters'),
                createDialog: function (title) { return new Window('dialog', title); },
                instances: instances, layerCount: s.layers.length, rows: rows,
                drafts: editorDraft && editorDraft.key === draftKey ? editorDraft.drafts : {},
                lastPath: lastEditorPath && lastEditorPath.matchName === instances[0].matchName ? lastEditorPath.path : null,
                row: row, button: button, guard: guard, showDialog: showDialog,
                onDraftChange: function (drafts) { editorDraft = { key: draftKey, drafts: drafts }; },
                onPathChange: function (path) { lastEditorPath = { matchName: instances[0].matchName, path: FX.U.clone(path) }; }
            });
            if (!intent || disposed) { return; }
            cancelEditorContinuation();
            try {
                execution = confirmAndExecute(instances, 'set', { rows: intent.rows, removeKeyframes: intent.removeKeyframes, requireAll: true });
            } catch (editorApplyError) {
                cancelEditorContinuation();
                throw editorApplyError;
            }
            if (execution === true) {
                editorDraft = null;
            } else {
                cancelEditorContinuation();
                if (execution === false) {
                    status.text = 'Confirmation cancelled. Reopen Edit Parameters to recover all pending changes.';
                }
            }
        }
        function cancelEditorContinuation() {
            editorContinueRequest = null;
            if (editorContinueTask !== null) {
                var task = editorContinueTask;
                editorContinueTask = null;
                try { adapter.cancelTask(task); }
                catch (continuationCancelError) { diagnostics.error('editor-cancel-task', continuationCancelError); }
            }
        }
        function requestEditorContinuation(instances) {
            // Only the initial Edit action requests an editor after reading.
            // Applying a batch leaves reopening to the user's next Edit click.
            cancelEditorContinuation();
            var ids = [], i;
            for (i = 0; i < instances.length; i++) { ids.push(FX.Model.effectKey(instances[i])); }
            ids.sort();
            editorContinueRequest = { project: scanner.basic.project, keys: ids };
        }
        function queueEditorContinuation() {
            if (!editorContinueRequest || editorContinueTask !== null || disposed) { return; }
            var selection = selected(), keys = [], i,
                ready = FX.Presentation.selectionState(selection, true);
            for (i = 0; i < selection.instances.length; i++) { keys.push(FX.Model.effectKey(selection.instances[i])); }
            keys.sort();
            if (ready.action !== 'edit' || FX.JSON.stringify(keys) !== FX.JSON.stringify(editorContinueRequest.keys)) {
                cancelEditorContinuation();
                return;
            }
            try { editorContinueTask = adapter.schedule(editorCallback, sessionEpoch); }
            catch (continueScheduleError) {
                cancelEditorContinuation();
                reportError('editor-schedule', continueScheduleError);
            }
        }
        function selected() {
            var out = { instances: [], layers: [] },
                seen = {},
                i,
                e,
                l;
            for (i = 0; i < view.instances.length; i++) {
                e = view.instances[i];
                if (selectedEffects['$' + FX.Model.effectKey(e)]) {
                    out.instances.push(e);
                    seen['$' + FX.Model.layerKey(e)] = true;
                }
            }
            for (i = 0; i < view.layers.length; i++) {
                l = view.layers[i];
                if (
                    selectedLayers['$' + FX.Model.layerKey(l)] ||
                    seen['$' + FX.Model.layerKey(l)]
                ) {
                    out.layers.push(l);
                }
            }
            return out;
        }
        function nodeData(instances, layers) {
            return { instances: instances || [], layers: layers || [] };
        }
        function addNode(parent, title, data, leaf, id) {
            var n = parent.add(leaf ? 'item' : 'node', title);
            n.fxData = data;
            n.fxTitle = title;
            n.fxLeaf = !!leaf;
            n.fxParentNode = parent === tree ? null : parent;
            n.fxDepth = parent === tree ? 0 : parent.fxDepth + 1;
            n.helpTip =
                data.instances.length === 1
                    ? 'Original name: ' +
                      data.instances[0].effectName +
                      '\nmatchName: ' +
                      data.instances[0].matchName
                    : title;
            n.fxNodeKey = (parent.fxNodeKey || '') + '/' + (id || title);
            renderedNodes.push(n);
            if (selectionAnchor === n.fxNodeKey) {
                tree.anchor = n;
            }
            if (FX.U.own(expansion, '$' + n.fxNodeKey)) {
                n.expanded = expansion['$' + n.fxNodeKey];
            }
            if (activeNodeKey === n.fxNodeKey) {
                tree.selection = n;
                activeTarget = data;
            } else if (
                leaf &&
                !tree.selection &&
                data.instances.length === 1 &&
                FX.Model.effectKey(data.instances[0]) === activeEffectKey
            ) {
                tree.selection = n;
                activeTarget = data;
            }
            return n;
        }
        function refreshMarks(parent) {
            var wasSelecting = selecting,
                focus = tree.selection,
                i,
                label;
            selecting = true;
            try {
                for (i = 0; i < renderedNodes.length; i++) {
                    renderedNodes[i].fxSelected =
                        selectionMark(renderedNodes[i].fxData) === '[x] ';
                    label =
                        selectionMark(renderedNodes[i].fxData) +
                        renderedNodes[i].fxTitle;
                    if (renderedNodes[i].text !== label) {
                        renderedNodes[i].text = label;
                    }
                }
                if (tree.selection !== focus) {
                    tree.selection = focus;
                }
                tree.refresh();
            } catch (markError) {
                lastRender = null;
                presentationFailed = true;
                tree.control.enabled = false;
                updateActions();
                throw markError;
            } finally {
                selecting = wasSelecting;
            }
            if (parent === tree) {
                diagnostics.measure('selectionMarks', 0, renderedNodes.length);
            }
        }
        function toggleNode(flag) {
            var n = tree.selection;
            if (!n || !n.fxData) {
                return;
            }
            var data = n.fxData,
                i;
            for (i = 0; i < data.instances.length; i++) {
                selectedEffects['$' + FX.Model.effectKey(data.instances[i])] =
                    flag;
            }
            for (i = 0; i < data.layers.length; i++) {
                selectedLayers['$' + FX.Model.layerKey(data.layers[i])] = flag;
            }
            refreshMarks(tree);
            updateActions();
        }
        function setAll(flag) {
            activeTarget = null;
            var i, k;
            for (i = 0; i < view.instances.length; i++) {
                k = '$' + FX.Model.effectKey(view.instances[i]);
                if (flag === null) {
                    selectedEffects[k] = !selectedEffects[k];
                } else {
                    selectedEffects[k] = flag;
                }
            }
            for (i = 0; i < view.layers.length; i++) {
                k = '$' + FX.Model.layerKey(view.layers[i]);
                if (flag === null) {
                    selectedLayers[k] = !selectedLayers[k];
                } else {
                    selectedLayers[k] = flag;
                }
            }
            refreshMarks(tree);
            updateActions();
        }
        function render() {
            if (dialogs.length) {
                renderPending = true;
                return false;
            }
            if (
                disposed ||
                scanner.job ||
                renderInProgress ||
                batch.executing
            ) {
                return false;
            }
            var started = FX.U.now();
            renderInProgress = true;
            try {
                if (buildRender() === false) {
                    return false;
                }
                presentationFailed = false;
                tree.control.enabled = true;
                updateActions();
                return true;
            } catch (error) {
                lastRender = null;
                presentationFailed = true;
                try {
                    tree.control.enabled = false;
                    updateActions();
                } catch (ignoredActions) {}
                reportError('render', error);
                return false;
            } finally {
                renderInProgress = false;
                rendering = false;
                FX.U.measure(diagnostics, 'renderTotal', started, 1);
            }
        }
        function buildRender() {
            var inventory = scanner.inventory();
            if (!inventory || inventory.stale) {
                return false;
            }
            var renderStarted = FX.U.now(),
                mode = modes[groupBy.selection.index],
                i,
                j,
                g,
                e,
                key,
                tk,
                parent,
                compKey,
                filtered = FX.Filters.apply(
                    inventory,
                    FX.U.clone(filters),
                    false,
                    true
                );
            view = FX.Filters.search(filtered, displayQuery);
            var showLayers =
                mode === 'layers' ||
                (!view.instances.length && view.layers.length > 0);
            if (showLayers) {
                view = { layers: view.layers, instances: [] };
            }
            var total = showLayers ? view.layers.length : view.instances.length;
            page = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
            var signature = [
                    inventory.id,
                    scanner.analysisRevision,
                    mode,
                    FX.JSON.stringify(paths)
                ],
                si;
            for (si = 0; si < view.instances.length; si++) {
                signature.push(FX.Model.effectKey(view.instances[si]));
            }
            for (si = 0; si < view.layers.length; si++) {
                signature.push(FX.Model.layerKey(view.layers[si]));
            }
            var groupKey = FX.JSON.stringify(signature),
                treeKey = groupKey + '/' + page;
            if (lastRender === treeKey) {
                diagnostics.measure('renderReuse', 0, 1);
                updateActions();
                return;
            }
            var cached = null,
                groupStarted = FX.U.now();
            for (i = 0; i < groupCache.length; i++) {
                if (groupCache[i].key === groupKey) {
                    cached = groupCache[i];
                    break;
                }
            }
            if (cached) {
                groups = cached.groups;
                diagnostics.measure('groupingReuse', 0, 1);
            } else {
                groups = [];
                if (!showLayers && mode !== 'occurrences') {
                    groups = FX.Grouping.build(
                        view.instances,
                        mode,
                        paths,
                        true
                    );
                }
                groupCache.push({ key: groupKey, groups: groups });
                if (groupCache.length > 3) {
                    groupCache.shift();
                }
                diagnostics.measure(
                    'grouping',
                    FX.U.now() - groupStarted,
                    view.instances.length
                );
            }
            expansion = {};
            for (i = 0; i < renderedNodes.length; i++) {
                expansion['$' + renderedNodes[i].fxNodeKey] =
                    !!renderedNodes[i].expanded;
            }
            var treeStarted = FX.U.now();
            rendering = true;
            try {
                tree.removeAll();
                renderedNodes = [];
                pageEffects = {};
                var effects = {},
                    types = {},
                    rootMembers = {},
                    typeMembers = {},
                    byComp = {},
                    offset = 0,
                    first = page * pageSize,
                    last = first + pageSize;
                function effectPartition(group) {
                    return (
                        '$' +
                        group.matchName +
                        (mode === 'composition'
                            ? '/' + group.instances[0].compId
                            : '')
                    );
                }
                function push(map, k, value) {
                    if (!map[k]) {
                        map[k] = [];
                    }
                    map[k].push(value);
                }
                if (mode === 'occurrences' && !showLayers) {
                    for (
                        i = first;
                        i < view.instances.length && i < last;
                        i++
                    ) {
                        e = view.instances[i];
                        addNode(
                            tree,
                            e.compName +
                                ' / ' +
                                e.layerName +
                                ' / ' +
                                e.effectIndex +
                                '. ' +
                                FX.Presentation.effectName(e) +
                                (e.enabled === false ? ' [Disabled]' : ''),
                            nodeData([e]),
                            true,
                            FX.Model.effectKey(e)
                        );
                        pageEffects['$' + FX.Model.effectKey(e)] = true;
                    }
                }
                for (i = 0; i < groups.length; i++) {
                    g = groups[i];
                    key = effectPartition(g);
                    tk = key + '/' + g.layerType;
                    for (j = 0; j < g.instances.length; j++) {
                        push(rootMembers, key, g.instances[j]);
                        push(typeMembers, tk, g.instances[j]);
                    }
                }
                for (i = 0; i < groups.length; i++) {
                    g = groups[i];
                    var groupFirst = offset;
                    offset += g.instances.length;
                    if (offset <= first || groupFirst >= last) {
                        continue;
                    }
                    key = effectPartition(g);
                    tk = key + '/' + g.layerType;
                    parent = effects[key];
                    if (!parent) {
                        var title = FX.Presentation.effectName(g);
                        if (mode === 'composition') {
                            title = g.compName + ' / ' + title;
                        }
                        parent = addNode(
                            tree,
                            title +
                                ' - ' +
                                rootMembers[key].length +
                                ' effects',
                            nodeData(rootMembers[key]),
                            false,
                            key
                        );
                        effects[key] = parent;
                        if (!FX.U.own(expansion, '$' + parent.fxNodeKey)) {
                            parent.expanded = true;
                        }
                    }
                    if (
                        mode === 'type' ||
                        mode === 'type-config' ||
                        mode === 'selected'
                    ) {
                        if (!types[tk]) {
                            types[tk] = addNode(
                                parent,
                                g.layerType +
                                    ' Layers - ' +
                                    typeMembers[tk].length +
                                    ' effects',
                                nodeData(typeMembers[tk]),
                                false,
                                tk
                            );
                            if (
                                !FX.U.own(expansion, '$' + types[tk].fxNodeKey)
                            ) {
                                types[tk].expanded = true;
                            }
                        }
                        parent = types[tk];
                    }
                    if (mode !== 'effect' && mode !== 'type') {
                        parent = addNode(
                            parent,
                            FX.Presentation.groupTitle(g),
                            nodeData(g.instances),
                            false,
                            g.id
                        );
                        parent.fxGroup = g;
                    }
                    var compMembers = {},
                        compNodes = {};
                    for (j = 0; j < g.instances.length; j++) {
                        push(
                            compMembers,
                            '$' + g.instances[j].compId,
                            g.instances[j]
                        );
                    }
                    for (
                        j = Math.max(0, first - groupFirst);
                        j < g.instances.length && groupFirst + j < last;
                        j++
                    ) {
                        e = g.instances[j];
                        compKey = '$' + e.compId;
                        if (!compNodes[compKey]) {
                            compNodes[compKey] = addNode(
                                parent,
                                e.compName,
                                nodeData(compMembers[compKey]),
                                false,
                                compKey
                            );
                        }
                        addNode(
                            compNodes[compKey],
                            e.layerName +
                                ' / ' +
                                FX.Presentation.effectName(e) +
                                (e.enabled === false ? ' / Disabled' : ''),
                            nodeData([e]),
                            true,
                            FX.Model.effectKey(e)
                        );
                        pageEffects['$' + FX.Model.effectKey(e)] = true;
                    }
                }
                if (showLayers) {
                    var layerRoot = addNode(
                            tree,
                            'Layers - ' + view.layers.length,
                            nodeData([], view.layers),
                            false,
                            'layers'
                        ),
                        layerMembers = {};
                    for (i = 0; i < view.layers.length; i++) {
                        push(
                            layerMembers,
                            '$' + view.layers[i].compId,
                            view.layers[i]
                        );
                    }
                    for (i = first; i < view.layers.length && i < last; i++) {
                        e = view.layers[i];
                        compKey = '$' + e.compId;
                        if (!byComp[compKey]) {
                            byComp[compKey] = addNode(
                                layerRoot,
                                e.compName,
                                nodeData([], layerMembers[compKey]),
                                false,
                                compKey
                            );
                        }
                        addNode(
                            byComp[compKey],
                            e.layerName + ' / ' + e.layerType,
                            nodeData([], [e]),
                            true,
                            FX.Model.layerKey(e)
                        );
                    }
                }
                pager.visible = total > pageSize;
                pager.maximumSize.height = pager.visible ? 10000 : 0;
                previousPage.enabled = page > 0;
                nextPage.enabled = last < total;
                pageText.text =
                    (total ? first + 1 : 0) +
                    '-' +
                    Math.min(last, total) +
                    ' / ' +
                    total;
                pageText.helpTip =
                    'Pages limit displayed rows. Group selection includes all matching occurrences; the counter and confirmation show targets.';
            } finally {
                rendering = false;
                diagnostics.measure(
                    'treeBuild',
                    FX.U.now() - treeStarted,
                    renderedNodes.length
                );
            }
            refreshMarks(tree);
            updateActions();
            layoutViewport();
            lastRender = treeKey;
            diagnostics.measure(
                'render',
                FX.U.now() - renderStarted,
                renderedNodes.length
            );
        }
        function actionIds() {
            var s = selected(),
                state = FX.Presentation.selectionState(s, true),
                ids = [];
            if (s.instances.length) {
                if (state.same && state.analyzed) {
                    ids.push('copy');
                }
                ids.push('enable');
                ids.push('disable');
                ids.push('remove');
            }
            if (s.layers.length) {
                ids.push('apply');
            }
            return ids;
        }
        function updateActions() {
            var layoutChanged = resultsButton.visible !== !!lastReport;
            searchButton.enabled = !busy;
            mainView.enabled = !busy;
            resultsButton.enabled = !!lastReport && !busy;
            selectResultsButton.enabled =
                !!scanner.basic &&
                !scanner.basic.stale &&
                !busy &&
                (view.instances.length > 0 || view.layers.length > 0);
            resultsButton.visible = !!lastReport;
            parameterGroup.visible = false;
            parameterGroup.enabled = !busy && parameterGroup.visible;
            var s = selected(),
                fresh = !!scanner.basic && !scanner.basic.stale,
                choice = FX.Presentation.selectionState(s, fresh),
                hidden = 0,
                inventory = scanner.inventory(),
                i;
            if (inventory) {
                for (i = 0; i < inventory.instances.length; i++) {
                    if (
                        selectedEffects[
                            '$' + FX.Model.effectKey(inventory.instances[i])
                        ]
                    ) {
                        hidden++;
                    }
                }
            }
            hidden -= s.instances.length;
            var offPage = 0;
            if (view.instances.length > pageSize) {
                for (i = 0; i < s.instances.length; i++) {
                    if (
                        !pageEffects['$' + FX.Model.effectKey(s.instances[i])]
                    ) {
                        offPage++;
                    }
                }
            }
            summary.text =
                s.instances.length +
                ' effects / ' +
                s.layers.length +
                ' layers selected';
            if (s.instances.length && choice.same) {
                summary.text =
                    FX.Presentation.effectName(s.instances[0]) +
                    ' - ' +
                    summary.text;
            }
            if (hidden > 0) {
                summary.text += ' (' + hidden + ' hidden, excluded)';
            }
            if (offPage) {
                summary.text += ' (' + offPage + ' on other pages, included)';
            }
            primaryButton.text = 'Select an effect';
            if (choice.action === 'scan') {
                primaryButton.text = fresh ? 'Scan' : 'Refresh';
            }
            if (choice.action === 'analyze') {
                primaryButton.text = choice.same ? 'Edit Parameters...' : 'Read Parameters';
            }
            if (choice.action === 'edit') {
                primaryButton.text = 'Edit Parameters...';
            }
            primaryButton.enabled = !busy && choice.action !== 'none';
            primaryButton.visible = !!scanner.basic;
            primaryButton.helpTip = choice.message;
            scanButton.text =
                scanner.basic && scanner.basic.stale ? 'Refresh' : 'Scan';
            locateButton.enabled = fresh && !busy && s.layers.length > 0;
            actionsButton.enabled = fresh && !busy && actionIds().length > 0;
            enableButton.enabled = fresh && !busy && s.instances.length > 0;
            disableButton.enabled = enableButton.enabled;
            addButton.enabled = fresh && !busy && s.layers.length > 0;
            presetsButton.enabled = !busy;
            if (!busy) {
                status.text = choice.message;
            }
            if (fresh && !view.instances.length && !view.layers.length) {
                status.text = 'No results. Change search or filters.';
            }
            if (presentationFailed) {
                primaryButton.text = 'Retry display';
                primaryButton.enabled = !busy;
                locateButton.enabled = false;
                actionsButton.enabled = false;
                enableButton.enabled =
                    disableButton.enabled =
                    addButton.enabled =
                        false;
                status.text =
                    'Display failed. Retry display, press Enter or run Scan. Scanner data retained.';
            }
            if (searchPending) {
                primaryButton.enabled = false;
                locateButton.enabled = false;
                actionsButton.enabled = false;
                enableButton.enabled =
                    disableButton.enabled =
                    addButton.enabled =
                        false;
                status.text =
                    'Search pending. Click Search, press Enter or select a matching result.';
            }
            if (layoutChanged) {
                layoutViewport();
            }
        }
        function searchProject() {
            if (disposed || busy || renderInProgress || dialogs.length) {
                return false;
            }
            if (!scanner.basic || scanner.basic.stale) {
                displayQuery = search.text;
                searchPending = false;
                runScan(!!scanner.basic);
                return (
                    !!scanner.job || (!!scanner.basic && !scanner.basic.stale)
                );
            }
            return applySearch();
        }
        function applySearch() {
            if (renderInProgress || disposed || dialogs.length || scanner.job) {
                return false;
            }
            if (!scanner.basic || scanner.basic.stale) {
                status.text =
                    'Click Search to inventory the selected scope first.';
                return false;
            }
            displayQuery = search.text;
            searchPending = false;
            page = 0;
            if (render()) {
                status.text =
                    view.instances.length +
                    ' effects / ' +
                    view.layers.length +
                    ' layers match. Select a result to continue.';
                if (!view.instances.length && !view.layers.length) {
                    status.text = 'No results. Change search or filters.';
                }
                return true;
            }
            return false;
        }
        function context() {
            updateActions();
        }
        function actionsDialog() {
            FX.U.assert(
                !busy && scanner.basic && !scanner.basic.stale,
                'Refresh before continuing.'
            );
            var ids = actionIds(),
                selection = selected(),
                choice = FX.Presentation.selectionState(selection, true),
                action = null;
            if (!ids.length) {
                status.text = 'Select an effect or group to continue.';
                return;
            }
            var d = new Window('dialog', 'More Actions');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var actionHost = d, actionLine = null, actionColumn = 0;
            function actionSection(title) {
                actionHost = d.add('panel', undefined, title);
                actionHost.orientation = 'column';
                actionHost.alignChildren = 'fill';
                actionLine = null;
                actionColumn = 0;
            }
            function actionButton(title, id) {
                if (!actionLine || actionColumn === 2) {
                    actionLine = row(actionHost);
                    actionColumn = 0;
                }
                actionColumn++;
                button(actionLine, title, function () {
                    action = id;
                    d.close(1);
                });
            }
            var i,
                names = {
                    copy: 'Copy Settings From...',
                    enable: 'Enable',
                    disable: 'Disable',
                    remove: 'Remove',
                    apply: 'Apply Effect...'
                };
            actionSection('Parameters');
            if (selection.instances.length && !choice.analyzed) {
                actionButton('Read Parameters', 'read-parameters');
            }
            for (i = 0; i < ids.length; i++) {
                if (ids[i] === 'copy') { actionButton(names[ids[i]], ids[i]); }
            }
            if (selection.instances.length && choice.same && choice.analyzed) {
                actionButton('Compare...', 'compare');
                if (selection.instances.length <= 2) {
                    actionButton('Inspect Animation...', 'animation');
                }
            }
            if (selection.instances.length) {
                if (choice.action === 'edit') {
                    actionButton('Copy Parameters...', 'capture-parameters');
                    actionButton('Save Effect Preset...', 'save-preset');
                    if (
                        parameterClipboard &&
                        parameterClipboard.matchName ===
                            selection.instances[0].matchName
                    ) {
                        actionButton('Paste Parameters...', 'paste-parameters');
                    }
                }
            }
            actionSection('Effects');
            for (i = 0; i < ids.length; i++) {
                if (ids[i] !== 'copy') { actionButton(names[ids[i]], ids[i]); }
            }
            actionSection('Selection and display');
            actionButton('Add to Selection', 'add');
            actionButton('Clear Selection', 'clear');
            actionButton('Selection...', 'selection');
            actionButton('Grouping...', 'groups');
            actionSection('Support');
            if (selection.instances.length) { actionButton('Details...', 'details'); }
            actionButton('Diagnostics...', 'diagnostics');
            if (lastReport && lastReport.issues.length) {
                actionButton('Issues...', 'issues');
            }
            button(d, 'Cancel', function () {
                d.close(0);
            });
            if (showDialog(d) !== 1) {
                return;
            }
            // Close the action chooser before opening a work dialog.
            if (action === 'read-parameters') {
                analyzeSelection();
            } else if (action === 'add') {
                adding = true;
                status.text = 'Click another group to add it to the selection.';
            } else if (action === 'clear') {
                clearSelection();
            } else if (action === 'selection') {
                selectionDialog();
            } else if (action === 'groups') {
                advancedGroups();
            } else if (action === 'capture-parameters') {
                captureParameters();
            } else if (action === 'save-preset') {
                saveEffectPreset();
            } else if (action === 'paste-parameters') {
                pasteParameters();
            } else if (action === 'compare') {
                compareDialog();
            } else if (action === 'animation') {
                animationDialog();
            } else if (action === 'details') {
                detailsDialog();
            } else if (action === 'diagnostics') {
                diagnosticDialog();
            } else if (action === 'issues') {
                issuesDialog();
            } else if (action === 'copy') {
                sourceRows = null;
                copyReference();
                if (sourceRows && sourceRows.length) {
                    confirmAndExecute(selection.instances, 'copy', {
                        rows: sourceRows
                    });
                }
            } else if (action === 'apply') {
                effectMatchName = '';
                chooseEffect();
                if (effectMatchName) {
                    confirmAndExecute(selection.layers, 'apply', {
                        matchName: effectMatchName,
                        displayName: effectDisplayName
                    });
                }
            } else if (action) {
                confirmAndExecute(selection.instances, action, {});
            }
        }
        function invalidateScope() {
            cancelEditorContinuation();
            scanner.invalidate();
            refreshTargets = null;
            pendingRestore = null;
            pendingParameterRefresh = null;
            activeEffectKey = null;
            activeNodeKey = null;
            activeTarget = null;
            groupCache = [];
            renderedNodes = [];
            lastRender = null;
            pager.visible = false;
            pager.maximumSize.height = 0;
            busy = false;
            scanButton.enabled = true;
            cancelButton.enabled = false;
            selectedEffects = {};
            selectedLayers = {};
            view = { layers: [], instances: [] };
            tree.removeAll();
            updateActions();
            status.text = 'Results Outdated - scope changed. Run Scan.';
            state.preferences.scope = scopes[scope.selection.index];
            save();
        }
        scope.onChange = guard(function () {
            if (initializing) {
                return;
            }
            choose.enabled = scope.selection.index === 1;
            invalidateScope();
        }, 'scope-change');
        search.onChanging = search.onChange = guard(function () {
            searchPending = search.text !== displayQuery;
            diagnostics.measure('searchDeferred', 0, 1);
            updateActions();
        }, 'search.onChanging');
        search.addEventListener(
            'keydown',
            guard(function (event) {
                if (event.keyName === 'Enter' || event.keyName === 'Return') {
                    searchProject();
                    if (event.preventDefault) {
                        event.preventDefault();
                    }
                }
            }, 'search.keydown')
        );
        function setGroupSelection(index) {
            var previous = viewSyncing;
            viewSyncing = true;
            try {
                if (!groupBy.selection || groupBy.selection.index !== index) {
                    groupBy.selection = index;
                }
            } finally {
                viewSyncing = previous;
            }
        }
        function syncMainView() {
            var index = 1,
                previous = viewSyncing;
            if (modes[groupBy.selection.index] === 'layers') {
                index = 2;
            }
            if (modes[groupBy.selection.index] === 'occurrences') {
                index = 0;
            }
            viewSyncing = true;
            try {
                if (!mainView.selection || mainView.selection.index !== index) {
                    mainView.selection = index;
                }
            } finally {
                viewSyncing = previous;
            }
        }
        groupBy.onChange = guard(function () {
            if (
                initializing ||
                viewSyncing ||
                viewChanging ||
                busy ||
                dialogs.length ||
                !groupBy.selection
            ) {
                return;
            }
            viewChanging = true;
            try {
                if (
                    modes[groupBy.selection.index] === 'selected' &&
                    !paths.length
                ) {
                    setGroupSelection(
                        lastValidGroup === 4 ? 7 : lastValidGroup
                    );
                    status.text =
                        'Choose parameters explicitly in More > Grouping...';
                }
                lastValidGroup = groupBy.selection.index;
                syncMainView();
                if (
                    modes[groupBy.selection.index] !== 'layers' &&
                    modes[groupBy.selection.index] !== 'occurrences'
                ) {
                    advancedChoice = groupBy.selection.index;
                    state.preferences.groupBy = modes[groupBy.selection.index];
                    save();
                }
                render();
            } finally {
                viewChanging = false;
            }
        });
        function advancedGroups() {
            if (
                initializing ||
                advancedDialogOpen ||
                busy ||
                dialogs.length ||
                disposed
            ) {
                return false;
            }
            advancedDialogOpen = true;
            try {
                var d = new Window('dialog', 'Grouping');
                d.orientation = 'column';
                d.alignChildren = 'fill';
                d.add(
                    'statictext',
                    undefined,
                    'Optional comparison views. Effects and Layers do not require grouping.'
                );
                var choice = dropdown(d, [
                    'Configuration / layer type',
                    'Effect',
                    'Effect / layer type',
                    'Full configuration',
                    'Selected parameters',
                    'Composition / configuration'
                ]);
                choice.selection = advancedChoice;
                var requested = advancedChoice;
                button(d, 'Use view', function () {
                    requested = choice.selection.index;
                    d.close(1);
                });
                button(d, 'Cancel', function () {
                    d.close(0);
                });
                if (showDialog(d) !== 1) {
                    return false;
                }
                if (requested === 4) {
                    if (!chooseGrouping()) {
                        return false;
                    }
                }
                advancedChoice = requested;
                setGroupSelection(requested);
                groupBy.onChange();
                return true;
            } finally {
                advancedDialogOpen = false;
            }
        }
        mainView.onChange = guard(function () {
            if (
                initializing ||
                viewSyncing ||
                viewChanging ||
                busy ||
                dialogs.length ||
                !mainView.selection
            ) {
                return;
            }
            var index = advancedChoice;
            if (mainView.selection.index !== 1) {
                index = mainView.selection.index === 2 ? 6 : 7;
            }
            setGroupSelection(index);
            groupBy.onChange();
        }, 'view');
        function beginWork() {
            busy = true;
            try {
                scanButton.enabled = false;
                cancelButton.enabled = true;
                updateActions();
                tick();
            } catch (error) {
                sessionEpoch++;
                scanner.cancel();
                busy = false;
                try {
                    scanButton.enabled = true;
                    cancelButton.enabled = false;
                    updateActions();
                } catch (ignoredControls) {}
                throw error;
            }
        }
        function runScan(restore, readParameters) {
            if (
                disposed ||
                ticking ||
                scanner.ticking ||
                renderInProgress ||
                dialogs.length ||
                batch.executing
            ) {
                return;
            }
            // Do not clear the tree, selection or recovery intent until scope preparation succeeds.
            scanner.start(scopes[scope.selection.index], manualIds);
            if (!readParameters) { cancelEditorContinuation(); }
            sessionEpoch++;
            pendingParameterRefresh = null;
            pendingRestore = restore ? refreshTargets : null;
            if (pendingRestore) {
                pendingRestore.readParameters = readParameters === true;
            }
            selectedEffects = {};
            selectedLayers = {};
            activeTarget = null;
            activeNodeKey = null;
            activeEffectKey = null;
            groupCache = [];
            lastRender = null;
            if (!readParameters) {
                page = 0;
            }
            editorDraft = null;
            beginWork();
        }
        function rememberRefreshTargets(targets, operation) {
            var selection = { instances: [], layers: [] },
                base = scanner.basic,
                layers = {},
                counts = {},
                selectedCounts = {},
                i,
                j,
                l,
                stack,
                e,
                k;
            refreshTargets = { project: base.project, layers: [], effects: [],
                activeEffectKey: activeEffectKey, page: page, readParameters: false };
            for (i = 0; i < base.layers.length; i++) {
                layers['$' + FX.Model.layerKey(base.layers[i])] =
                    base.layers[i];
            }
            var selectedLayerKeys = {};
            for (i = 0; i < targets.length; i++) {
                k = '$' + FX.Model.layerKey(targets[i]);
                if (operation !== 'apply') {
                    selection.instances.push(targets[i]);
                    var family = k + '/' + FX.JSON.stringify([targets[i].matchName, targets[i].effectName]);
                    selectedCounts[family] = (selectedCounts[family] || 0) + 1;
                }
                if (layers[k] && !selectedLayerKeys[k]) {
                    selection.layers.push(layers[k]);
                    selectedLayerKeys[k] = true;
                }
            }
            for (i = 0; i < selection.layers.length; i++) {
                l = layers['$' + FX.Model.layerKey(selection.layers[i])];
                if (l && l.layerId !== null && l.layerId !== undefined) {
                    refreshTargets.layers.push({
                        key: FX.Model.layerKey(l),
                        name: l.layerName,
                        signature: l.stackSignature
                    });
                }
            }
            for (i = 0; i < selection.instances.length; i++) {
                e = selection.instances[i];
                l = layers['$' + FX.Model.layerKey(e)];
                if (!l || l.layerId === null || l.layerId === undefined) {
                    continue;
                }
                k = '$' + FX.Model.layerKey(l);
                if (!counts[k]) {
                    counts[k] = {};
                    stack = FX.JSON.parse(l.stackSignature);
                    for (j = 0; j < stack.length; j++) {
                        var identity =
                            '$' +
                            FX.JSON.stringify([
                                stack[j].matchName,
                                stack[j].name
                            ]);
                        counts[k][identity] = (counts[k][identity] || 0) + 1;
                    }
                }
                identity = '$' + FX.JSON.stringify([e.matchName, e.effectName]);
                refreshTargets.effects.push({
                    key: FX.Model.effectKey(e),
                    layerKey: FX.Model.layerKey(e),
                    name: e.effectName,
                    matchName: e.matchName,
                    signature: l.stackSignature,
                    unique: counts[k][identity] === 1,
                    completeFamily: selectedCounts[k + '/' + FX.JSON.stringify([e.matchName, e.effectName])] === counts[k][identity]
                });
            }
        }
        function restoreRefreshTargets(result) {
            var saved = pendingRestore;
            if (!saved || saved.project !== result.project) {
                return null;
            }
            var layers = {},
                effects = {},
                i,
                l,
                e,
                restored = 0,
                targets = [];
            for (i = 0; i < result.layers.length; i++) {
                layers['$' + FX.Model.layerKey(result.layers[i])] =
                    result.layers[i];
            }
            for (i = 0; i < result.instances.length; i++) {
                effects['$' + FX.Model.effectKey(result.instances[i])] =
                    result.instances[i];
            }
            for (i = 0; i < saved.layers.length; i++) {
                l = layers['$' + saved.layers[i].key];
                if (l && l.layerName === saved.layers[i].name) {
                    selectedLayers['$' + saved.layers[i].key] = true;
                }
            }
            for (i = 0; i < saved.effects.length; i++) {
                var old = saved.effects[i];
                e = effects['$' + old.key];
                l = layers['$' + old.layerKey];
                if (
                    e &&
                    l &&
                    (old.unique || old.completeFamily) &&
                    l.stackSignature === old.signature &&
                    e.effectName === old.name &&
                    e.matchName === old.matchName
                ) {
                    selectedEffects['$' + old.key] = true;
                    targets.push(e);
                    restored++;
                }
            }
            pendingRestore = null;
            refreshTargets = null;
            if (saved.readParameters) {
                page = saved.page;
                if (saved.activeEffectKey && selectedEffects['$' + saved.activeEffectKey]) {
                    activeEffectKey = saved.activeEffectKey;
                }
            }
            return {
                restored: restored,
                skipped: saved.effects.length - restored,
                targets: targets,
                readParameters: saved.readParameters
            };
        }
        function currentFilters() {
            return FX.U.clone(filters);
        }
        var callback = 'FXExchangerTick_' + FX.U.id('ui').replace(/-/g, '_'),
            editorCallback = callback + '_Editor';
        $.global[editorCallback] = guard(function (epoch) {
            editorContinueTask = null;
            var request = editorContinueRequest;
            editorContinueRequest = null;
            if (!request || disposed || epoch !== sessionEpoch || busy || scanner.job || dialogs.length ||
                request.project !== adapter.project()) { return; }
            var targets = selected().instances, keys = [], i;
            for (i = 0; i < targets.length; i++) { keys.push(FX.Model.effectKey(targets[i])); }
            keys.sort();
            if (FX.JSON.stringify(keys) !== FX.JSON.stringify(request.keys)) { return; }
            editParameters();
        }, 'editor-continuation');
        function tick() {
            diagnostics.measure('callbacks', 0, 1);
            if (disposed || ticking || !scanner.job) {
                return;
            }
            ticking = true;
            try {
                // Cancel even an early/duplicate invocation; failure cannot leave a live job.
                if (scanner.task !== null) {
                    var pending = scanner.task;
                    scanner.task = null;
                    adapter.cancelTask(pending);
                }
                if (
                    scanner.tick() &&
                    !disposed &&
                    scanner.job &&
                    scanner.task === null
                ) {
                    scanner.task = adapter.schedule(callback, sessionEpoch);
                }
            } catch (e) {
                pendingParameterRefresh = null;
                cancelEditorContinuation();
                pendingRestore = null;
                scanner.invalidate();
                busy = false;
                scanButton.enabled = true;
                cancelButton.enabled = false;
                status.text =
                    'Error - operation stopped. See Diagnostics; run Scan again.';
                reportError('scan', e);
            } finally {
                ticking = false;
            }
        }
        $.global[callback] = function (epoch) {
            if (!disposed && epoch === sessionEpoch) {
                tick();
            }
        };
        scanner.onObserverError = function (name, error) {
            reportError('presentation/' + name, error);
        };
        scanner.onProgress = function (l, e, c, total, phase) {
            status.text =
                (phase === 'basic'
                    ? 'Scanning '
                    : 'Analyzing Configurations ') +
                Math.min(c + 1, total) +
                ' / ' +
                total +
                (phase === 'basic' ? ' compositions; ' : ' candidates; ') +
                l +
                ' layers / ' +
                e +
                ' effects';
        };
        scanner.onDone = function (result) {
            if (disposed) {
                return;
            }
            busy = false;
            scanButton.enabled = true;
            cancelButton.enabled = false;
            var recovered =
                result.analysisState === 'basic'
                    ? restoreRefreshTargets(result)
                    : null;
            if (recovered && recovered.readParameters && recovered.targets.length) {
                try {
                    // This continues the explicit edit request, over its safely
                    // recovered targets only. The next scheduler tick performs
                    // the read; no nested ticks, dialogs or repeated writes.
                    scanner.analyze({}, recovered.targets);
                    pendingParameterRefresh = {
                        project: result.project,
                        expected: recovered.targets.length,
                        skipped: recovered.skipped
                    };
                    busy = true;
                    scanButton.enabled = false;
                    cancelButton.enabled = true;
                    status.text = 'Changes applied. Updating parameters for ' + recovered.targets.length + ' selected effects...';
                    updateActions();
                    return;
                } catch (readStartError) {
                    pendingParameterRefresh = null;
                    cancelEditorContinuation();
                    scanner.cancel();
                    busy = false;
                    scanButton.enabled = true;
                    cancelButton.enabled = false;
                    render();
                    reportError('post-edit-read', readStartError);
                    status.text = 'Changes applied. Parameters could not be updated; review Results and refresh/read parameters to continue.';
                    return;
                }
            }
            var parameterRefresh = pendingParameterRefresh;
            pendingParameterRefresh = null;
            var displayed = render();
            if (!displayed) { cancelEditorContinuation(); }
            if (parameterRefresh && displayed && parameterRefresh.project === result.project) {
                var visibleSelection = selected(),
                    ready = FX.Presentation.selectionState(visibleSelection, true);
                status.text = 'Changes applied. Parameters updated for ' + result.instances.length +
                    '/' + parameterRefresh.expected + ' effects. ';
                if (ready.action === 'edit') {
                    status.text += 'Ready to continue editing the selection.';
                } else {
                    status.text += ready.message;
                }
                if (visibleSelection.instances.length < result.instances.length) {
                    status.text += ' Some updated effects no longer match the current filters.';
                }
                if (parameterRefresh.skipped) {
                    status.text += ' ' + parameterRefresh.skipped + ' changed/ambiguous targets were not restored.';
                }
                queueEditorContinuation();
                return;
            }
            if (recovered && displayed) {
                status.text +=
                    ' Restored ' +
                    recovered.restored +
                    ' effects; ' +
                    recovered.skipped +
                    ' ambiguous/changed targets not restored.';
            }
            if (displayed && result.analysisState === 'analyzed') { queueEditorContinuation(); }
        };
        batch.onProgress = function (index, total) {
            if (!disposed) {
                status.text =
                    'Applying target ' +
                    (index + 1) +
                    ' / ' +
                    total +
                    '. Await host return; Cancel cannot interrupt a synchronous API.';
            }
        };
        function confirmAndExecute(targets, id, options) {
            var plan = batch.preview(targets, id, options),
                title = id,
                description = '',
                partial = false,
                i,
                j;
            if (options && options.rows && id !== 'apply') {
                title = 'Change ' + FX.Presentation.effectName(targets[0]);
                for (i = 0; i < options.rows.length; i++) {
                    var change = options.rows[i],
                        values = {},
                        distinct = [],
                        count = 0,
                        removedKeys = 0,
                        animatedTargets = 0,
                        authorized,
                        ai,
                        old,
                        prior,
                        key;
                    for (j = 0; j < targets.length; j++) {
                        prior = FX.Presentation.parameterStatus(targets[j], change.path);
                        if (prior.hasValue) {
                            key = '$' + FX.JSON.stringify(prior.currentValue);
                            if (!values[key]) { values[key] = 0; distinct.push(prior.currentValue); }
                            values[key]++;
                        }
                        old = FX.Config.row(
                            targets[j].configuration,
                            change.path
                        );
                        if (
                            old &&
                            old.valueType === change.valueType &&
                            !targets[j].locked
                        ) {
                            count++;
                        }
                        authorized = (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(targets[j])] || [];
                        for (ai = 0; ai < authorized.length; ai++) {
                            if (FX.Config.key(authorized[ai].path) === FX.Config.key(change.path)) {
                                count++;
                                animatedTargets++;
                                removedKeys += authorized[ai].keyCount;
                            }
                        }
                    }
                    var fromParts = [], vi;
                    for (vi = 0; vi < distinct.length; vi++) {
                        fromParts.push(FX.Parameters.display(change, distinct[vi]) +
                            ' (' + values['$' + FX.JSON.stringify(distinct[vi])] + ')');
                    }
                    var from = fromParts.length ? fromParts.join('; ') : 'Unavailable';
                    description +=
                        change.name +
                        ': ' +
                        from +
                        ' -> ' +
                        (change.keepCurrent ? 'Keep each current value; clear keyframes' : FX.Parameters.display(change)) +
                        '\n';
                    if (removedKeys) {
                        description += 'Remove ' + removedKeys + ' keyframes in ' + animatedTargets +
                            ' effects for ' + change.name + (change.keepCurrent ? '; keep each current value.\n' : '; replace with this fixed value.\n');
                    }
                    if (count < targets.length) {
                        FX.U.assert(!options.requireAll, 'Cannot update all selected effects; adjust the selection or pending changes');
                        partial = true;
                        description +=
                            'Expected: ' +
                            count +
                            '/' +
                            targets.length +
                            ' effects; others preserved.\n';
                    }
                }
                description += 'Other parameters unchanged.\n';
                if (options.requireAll) { description += 'Every pending parameter applies to all ' + targets.length + ' selected effects.\n'; }
            } else if (id === 'remove') {
                description =
                    'Remove entire effects, including keyframes and expressions.\n';
            } else if (id === 'apply') {
                description =
                    'Apply ' +
                    (options.displayName || options.matchName) +
                    '.\n';
                if (options.rows) {
                    partial = true;
                    description +=
                        'Preset: ' +
                        options.presetName +
                        '. Adds a NEW instance and sets ' +
                        options.rows.length +
                        ' static parameters. Unsupported parameters may be skipped. Existing effects are not replaced. A failed write can leave the new instance in the project.\n';
                }
            }
            description +=
                'Affected: ' +
                targets.length +
                (id === 'apply' ? ' target layers / ' : ' effects / ') +
                plan.layerCount +
                ' layers / ' +
                plan.compCount +
                ' compositions.';
            var d = new Window('dialog', 'Confirm changes');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add('statictext', undefined, title);
            var text = d.add('edittext', undefined, description, {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [
                400,
                Math.min(
                    260,
                    70 + (options.rows ? options.rows.length * 32 : 0)
                )
            ];
            var agreement = null,
                animationAgreement = null;
            if (partial) {
                agreement = d.add(
                    'checkbox',
                    undefined,
                    'I agree to apply only compatible occurrences.'
                );
                agreement.value = false;
            }
            if (plan.keyframeCount) {
                animationAgreement = d.add('checkbox', undefined,
                    'I agree to remove ' + plan.keyframeCount + ' keyframes from the specified parameters.');
                animationAgreement.value = false;
            }
            var controls = row(d);
            var apply = button(controls, 'Apply', function () {
                if ((partial && !agreement.value) || (animationAgreement && !animationAgreement.value)) {
                    return;
                }
                d.close(1);
            });
            function updateAgreement() {
                apply.enabled = (!partial || agreement.value) &&
                    (!animationAgreement || animationAgreement.value);
            }
            updateAgreement();
            if (agreement) {
                agreement.onClick = updateAgreement;
            }
            if (animationAgreement) {
                animationAgreement.onClick = updateAgreement;
            }
            button(controls, 'Cancel', function () {
                d.close(0);
            });
            d.center();
            if (showDialog(d) !== 1 || disposed) {
                return false;
            }
            FX.U.assert(
                !dialogs.length,
                'Close dialogs before executing changes'
            );
            rememberRefreshTargets(targets, id);
            busy = true;
            lastReport = null;
            batch.lastReport = null;
            var batchFailure = null;
            try {
                scanButton.enabled = false;
                cancelButton.enabled = false;
                status.text =
                    'Validating all targets before writing. Synchronous host calls may block this panel.';
                updateActions();
                lastReport = batch.execute(plan);
            } catch (batchError) {
                lastReport = batch.lastReport;
                batchFailure = batchError;
            } finally {
                busy = false;
                scanButton.enabled = true;
                cancelButton.enabled = false;
                context();
            }
            if (batchFailure) {
                reportError('batch', batchFailure);
            }
            if (!lastReport) {
                return null;
            }
            reportText.visible = true;
            reportText.maximumSize.height = 10000;
            reportText.text = FX.Presentation.reportSummary(lastReport);
            context();
            status.text =
                'Review Results; Refresh before continuing. Do not retry uncertain writes automatically.';
            layoutViewport();
            if (
                settings.autoRefresh !== false &&
                lastReport.completed &&
                lastReport.changed > 0 &&
                !lastReport.failed &&
                !lastReport.unknown &&
                !lastReport.verificationFailed
            ) {
                runScan(true, id === 'set' || id === 'copy');
            }
            return true;
        }
        function presets() {
            if (!presetLibrary) {
                presetLibrary = new FX.Presets.Library(
                    settings.presetStore ||
                        (settings.noStorage ? null : FX.Presets.store())
                );
            }
            return presetLibrary;
        }
        function inputText(title, description, value) {
            var d = new Window('dialog', title),
                result = null;
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add('statictext', undefined, description, { multiline: true });
            var field = d.add('edittext', undefined, value || '');
            field.characters = 40;
            button(d, 'Save', function () {
                result = field.text;
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            return showDialog(d) === 1 ? result : null;
        }
        function parameterData() {
            var targets = selected().instances,
                i,
                chosen = 0,
                sourcesWithValues = [];
            FX.U.assert(targets.length, 'Select analyzed occurrences first.');
            for (i = 0; i < targets.length; i++) {
                FX.U.assert(
                    targets[i].configuration &&
                        targets[i].matchName === targets[0].matchName,
                    'Use Read Parameters and select one effect type first.'
                );
                if (targets[i].configuration.properties.length) {
                    sourcesWithValues.push(targets[i]);
                }
            }
            targets = sourcesWithValues;
            FX.U.assert(
                targets.length,
                'No compatible static parameters are available. Animation inspection is read only.'
            );
            var d = new Window('dialog', 'Copy Parameters');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                'Choose the source occurrence. Only the static parameters you choose will be copied.'
            );
            var sources = dropdown(d, []);
            for (i = 0; i < targets.length; i++) {
                sources.add(
                    'item',
                    targets[i].compName +
                        ' / ' +
                        targets[i].layerName +
                        ' / #' +
                        targets[i].effectIndex
                );
            }
            sources.selection = 0;
            button(d, 'Choose source', function () {
                chosen = sources.selection.index;
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            if (showDialog(d) !== 1) {
                return null;
            }
            var source = targets[chosen],
                rows = pickRows(
                    source.configuration,
                    'Choose parameters to copy'
                );
            if (!rows || !rows.length) {
                return null;
            }
            return {
                matchName: source.matchName,
                sourceName: FX.Presentation.effectName(source),
                rows: rows,
                omitted:
                    source.configuration.unsupported.length +
                    source.configuration.properties.length -
                    rows.length
            };
        }
        function captureParameters() {
            var data = parameterData();
            if (data) {
                parameterClipboard = FX.U.clone(data);
                status.text =
                    data.rows.length +
                    ' parameters copied. Select analyzed destinations of the same effect, then More > Paste Parameters.';
            }
        }
        function pasteParameters(preset) {
            var data = preset || parameterClipboard,
                targets = selected().instances,
                i,
                publicRows;
            FX.U.assert(
                data && targets.length,
                'Copy parameters or choose a preset, then select destinations.'
            );
            for (i = 0; i < targets.length; i++) {
                FX.U.assert(
                    targets[i].matchName === data.matchName &&
                        targets[i].configuration,
                    'Select analyzed occurrences of the same effect. Other effect types cannot receive these parameters.'
                );
            }
            publicRows = FX.Parameters.rows(data.matchName, FX.U.clone(data.rows));
            FX.U.assert(publicRows.length, 'No public parameters remain in this clipboard/preset.');
            return confirmAndExecute(targets, 'copy', {
                rows: publicRows
            });
        }
        function saveEffectPreset() {
            var data = parameterData();
            if (!data) {
                return;
            }
            var name = inputText(
                'Save effect preset',
                'Static parameters of one effect only. Omitted parameters: ' +
                    data.omitted +
                    '. Animation and expressions are not saved.',
                data.sourceName
            );
            if (name !== null) {
                presets().save(name, data.matchName, data.rows, data.omitted);
                status.text =
                    'Preset saved. Use Presets to edit/export or Add Effect to create a new instance.';
            }
        }
        function editPreset(preset) {
            var rows = FX.Parameters.rows(preset.matchName, FX.U.clone(preset.rows)),
                d = new Window('dialog', 'Edit preset');
            FX.U.assert(rows.length, 'This preset contains no public editable parameters.');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                preset.name + ' [' + preset.matchName + ']'
            );
            var list = d.add('listbox', undefined, []),
                i;
            list.preferredSize = [420, 220];
            for (i = 0; i < rows.length; i++) {
                list.add(
                    'item',
                    rows[i].name + ' = ' + FX.Parameters.display(rows[i])
                );
            }
            d.add(
                'statictext',
                undefined,
                'Edit one parameter per save. Number or JSON array; only the saved preset changes.'
            );
            var presetValueHost = d.add('group');
            presetValueHost.orientation = 'stack';
            presetValueHost.alignChildren = ['fill', 'center'];
            presetValueHost.minimumSize.height = 24;
            var value = presetValueHost.add('edittext', undefined, '');
            value.minimumSize = [180, 24];
            var presetMenu = presetValueHost.add('dropdownlist', undefined, []);
            presetMenu.minimumSize = [180, 24];
            presetMenu.fxPresetMenu = true;
            list.onChange = function () {
                if (list.selection) {
                    var selectedRow = rows[list.selection.index], c, item;
                    presetMenu.removeAll();
                    presetMenu.visible = !!(selectedRow.control && selectedRow.control.kind === 'menu');
                    value.visible = !presetMenu.visible;
                    if (presetMenu.visible) {
                        for (c = 0; c < selectedRow.control.choices.length; c++) {
                            item = presetMenu.add('item', selectedRow.control.choices[c].label);
                            item.fxValue = selectedRow.control.choices[c].value;
                            if (item.fxValue === selectedRow.value) { presetMenu.selection = item; }
                        }
                    }
                    value.text = FX.JSON.stringify(
                        rows[list.selection.index].value
                    );
                }
            };
            list.selection = 0;
            list.onChange();
            button(d, 'Save preset', function () {
                FX.U.assert(list.selection, 'Choose a parameter');
                var index = list.selection.index,
                    v;
                if (presetMenu.visible) {
                    FX.U.assert(presetMenu.selection, 'Choose a dropdown option');
                    v = presetMenu.selection.fxValue;
                } else {
                    v = FX.JSON.parse(value.text);
                }
                FX.Validate.value(rows[index].valueType, v);
                rows[index].value = v;
                presets().save(
                    preset.name,
                    preset.matchName,
                    rows,
                    preset.omitted + preset.rows.length - rows.length,
                    preset.id
                );
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function presetDialog() {
            if (busy || initializing || dialogs.length) {
                return;
            }
            var library = presets();
            while (!disposed) {
                var entries = library.list(),
                    action = null,
                    selectedId = null,
                    d = new Window('dialog', 'Effect presets');
                d.orientation = 'column';
                d.alignChildren = 'fill';
                d.add(
                    'statictext',
                    undefined,
                    'Single-effect static presets. No sets, keyframes or expressions.'
                );
                var list = d.add('listbox', undefined, []),
                    i;
                list.preferredSize = [460, 240];
                for (i = 0; i < entries.length; i++) {
                    list.add(
                        'item',
                        entries[i].name +
                            ' [' +
                            entries[i].matchName +
                            '] / ' +
                            entries[i].rows.length +
                            ' parameters'
                    );
                }
                if (entries.length) {
                    list.selection = 0;
                }
                function option(title, id, requiresPreset) {
                    var b = button(d, title, function () {
                        FX.U.assert(
                            !requiresPreset || list.selection,
                            'Choose a preset.'
                        );
                        selectedId = list.selection
                            ? entries[list.selection.index].id
                            : null;
                        action = id;
                        d.close(1);
                    });
                    b.enabled = !requiresPreset || entries.length > 0;
                    return b;
                }
                var current = selected(),
                    fresh =
                        scanner.basic &&
                        !scanner.basic.stale &&
                        !presentationFailed,
                    choice = FX.Presentation.selectionState(current, fresh);
                option('Save selected effect...', 'new', false).enabled =
                    !!fresh &&
                    !!current.instances.length &&
                    choice.action === 'edit';
                option('Edit values...', 'edit', true);
                option('Rename...', 'rename', true);
                option('Delete...', 'delete', true);
                var applyPreset = option(
                    'Apply to selected effects...',
                    'apply',
                    true
                );
                list.onChange = function () {
                    applyPreset.enabled =
                        !!fresh &&
                        !!list.selection &&
                        !!current.instances.length &&
                        choice.analyzed &&
                        choice.same &&
                        entries[list.selection.index].matchName ===
                            current.instances[0].matchName;
                };
                list.onChange();
                option('Import presets...', 'import', false);
                option('Export all presets...', 'export', false);
                button(d, 'Close', function () {
                    d.close(0);
                });
                if (showDialog(d) !== 1) {
                    return;
                }
                var p = selectedId ? library.get(selectedId) : null,
                    file,
                    storage,
                    name;
                if (action === 'new') {
                    saveEffectPreset();
                } else if (action === 'edit') {
                    editPreset(p);
                } else if (action === 'rename') {
                    name = inputText(
                        'Rename preset',
                        'New preset name',
                        p.name
                    );
                    if (name !== null) {
                        library.save(
                            name,
                            p.matchName,
                            p.rows,
                            p.omitted,
                            p.id
                        );
                    }
                } else if (action === 'delete') {
                    if (
                        confirm(
                            'Delete preset "' +
                                p.name +
                                '"? Stored backups remain available.'
                        )
                    ) {
                        library.remove(p.id);
                    }
                } else if (action === 'apply') {
                    pasteParameters(p);
                    return;
                } else if (action === 'import') {
                    file = File.openDialog(
                        'Import FX Exchanger presets',
                        'JSON:*.json'
                    );
                    if (file) {
                        storage = new FX.Store();
                        var raw = storage.readText(file),
                            doc = FX.Presets.validate(FX.JSON.parse(raw));
                        if (
                            confirm(
                                'Merge ' +
                                    doc.presets.length +
                                    ' presets? Existing IDs/names will not be overwritten; conflicts cancel the whole import.'
                            )
                        ) {
                            var result = library.importText(raw);
                            status.text =
                                result.added +
                                ' presets imported; ' +
                                result.skipped +
                                ' identical presets skipped.';
                        }
                    }
                } else if (action === 'export') {
                    file = File.saveDialog(
                        'Export all FX Exchanger presets',
                        'JSON:*.json'
                    );
                    if (file) {
                        new FX.Store().writeText(file, library.exportText());
                    }
                }
            }
        }
        function chooseEffect() {
            var all = adapter.inventory(),
                saved = [],
                presetLoadFailed = false;
            try {
                saved = presets().list();
            } catch (presetError) {
                presetLoadFailed = true;
                diagnostics.error('presets-load', presetError);
            }
            FX.U.assert(
                all.length || saved.length,
                'No effects are available to apply.'
            );
            var d = new Window('dialog', 'Choose effect to apply');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            if (presetLoadFailed) {
                d.add(
                    'statictext',
                    undefined,
                    'Saved presets unavailable. Original files preserved; see Help > Diagnostics.'
                );
            }
            var kind = dropdown(d, ['All effects', 'Saved presets']);
            var q = d.add('edittext', undefined, ''),
                list = d.add('listbox', undefined, []),
                items = [];
            list.preferredSize = [360, 260];
            function fill() {
                list.removeAll();
                items = [];
                var i,
                    source = kind.selection.index === 1 ? saved : all,
                    label,
                    presetMode = kind.selection.index === 1;
                for (i = 0; i < source.length; i++) {
                    label = presetMode ? source[i].name : source[i].displayName;
                    if (
                        FX.Filters.text(
                            label + ' ' + source[i].matchName,
                            q.text
                        )
                    ) {
                        items.push(source[i]);
                        list.add(
                            'item',
                            label + ' [' + source[i].matchName + ']'
                        );
                    }
                }
            }
            q.onChanging = fill;
            kind.onChange = fill;
            fill();
            var r = row(d);
            button(r, 'Cancel', function () {
                d.close(0);
            });
            button(r, 'Choose', function () {
                FX.U.assert(list.selection, 'Choose an effect');
                effectMatchName = items[list.selection.index].matchName;
                effectPreset =
                    kind.selection.index === 1
                        ? FX.U.clone(items[list.selection.index])
                        : null;
                if (effectPreset) {
                    var publicPresetRows = FX.Parameters.rows(effectPreset.matchName, effectPreset.rows);
                    FX.U.assert(publicPresetRows.length, 'This preset contains no public effect parameters.');
                    effectPreset.omitted += effectPreset.rows.length - publicPresetRows.length;
                    effectPreset.rows = publicPresetRows;
                }
                effectDisplayName = effectPreset
                    ? effectPreset.name
                    : items[list.selection.index].displayName;
                d.close(1);
            });
            showDialog(d);
        }
        function pickRows(config, title) {
            var publicRows = [], pi, profile = FX.Parameters.fromConfig(config);
            if (config) {
                for (pi = 0; pi < config.properties.length; pi++) {
                    if (!FX.Parameters.blocked(profile, config.properties[pi].path,
                        config.properties[pi].name, config.properties[pi].valueType)) {
                        publicRows.push(config.properties[pi]);
                    }
                }
            }
            FX.U.assert(
                config && publicRows.length,
                'No compatible static parameters are available.'
            );
            var d = new Window('dialog', title);
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var list = d.add('listbox', undefined, [], { multiselect: true });
            list.preferredSize = [400, 260];
            var i,
                out = null;
            for (i = 0; i < publicRows.length; i++) {
                var p = publicRows[i];
                list.add(
                    'item',
                    (p.name || FX.Config.key(p.path)) +
                        ' = ' +
                        FX.Parameters.display(p)
                );
            }
            d.add(
                'statictext',
                undefined,
                config.unsupported.length +
                    ' unsupported/animated/expression properties excluded.'
            );
            var r = row(d);
            button(r, 'Select All', function () {
                var j;
                for (j = 0; j < list.items.length; j++) {
                    list.items[j].selected = true;
                }
            });
            button(r, 'Cancel', function () {
                d.close(0);
            });
            button(r, 'Use selected', function () {
                var s = list.selection || [],
                    j;
                if (!FX.U.array(s)) {
                    s = [s];
                }
                FX.U.assert(s.length, 'Select parameters');
                out = [];
                for (j = 0; j < s.length; j++) {
                    out.push(FX.U.clone(publicRows[s[j].index]));
                }
                d.close(1);
            });
            showDialog(d);
            return out;
        }
        function copyReference() {
            var s = selected(),
                available = comparableInstances(),
                d = new Window('dialog', 'Choose copy reference');
            FX.U.assert(s.instances.length, 'Select target occurrences first.');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var chosenConfiguration = null;
            var list = d.add('listbox', undefined, []),
                i;
            list.preferredSize = [400, 200];
            for (i = 0; i < available.length; i++) {
                list.add(
                    'item',
                    available[i].compName +
                        ' / ' +
                        available[i].layerName +
                        ' / #' +
                        available[i].effectIndex +
                        ' ' +
                        available[i].effectName
                );
            }
            button(d, 'Use analyzed result', function () {
                FX.U.assert(
                    list.selection,
                    'Choose an analyzed reference occurrence.'
                );
                chosenConfiguration =
                    available[list.selection.index].configuration;
                d.close(1);
            });
            d.add(
                'statictext',
                undefined,
                'Optional: select ONE effect in After Effects Effect Controls first.',
                { multiline: true }
            );
            button(d, 'Use Effect Controls reference', function () {
                var e = adapter.selectedEffect();
                FX.U.assert(
                    String(e.matchName) === s.instances[0].matchName,
                    'Reference must be the same effect matchName.'
                );
                chosenConfiguration = adapter.capture(e);
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            if (showDialog(d) === 1 && chosenConfiguration) {
                sourceRows = pickRows(
                    chosenConfiguration,
                    'Copy selected static parameters'
                );
            }
        }
        function chooseGrouping() {
            FX.U.assert(
                scanner.basic && !scanner.basic.stale,
                'Run Scan and select an effect occurrence first'
            );
            var s = selected().instances;
            FX.U.assert(s.length, 'Select an occurrence first');
            FX.U.assert(
                s[0].configuration,
                'Select an occurrence and use Read Parameters first.'
            );
            var chosen = pickRows(
                s[0].configuration,
                'Group by selected parameters'
            );
            if (chosen) {
                paths = [];
                var i;
                for (i = 0; i < chosen.length; i++) {
                    paths.push(chosen[i].path);
                }
            }
            return !!(chosen && chosen.length);
        }
        function filterDialog() {
            var propertyFilters = FX.U.clone(filters.properties || []);
            if (filters.property) {
                propertyFilters.push(FX.U.clone(filters.property));
            }
            var d = new Window('dialog', 'Layer and effect filters');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var cn = d.add('edittext', undefined, filters.compName || '');
            cn.helpTip = 'Composition name contains';
            var type = dropdown(d, [
                    'Any',
                    'Adjustment',
                    'Text',
                    'Shape',
                    'Solid',
                    'Footage',
                    'Precomposition',
                    'Null',
                    'Camera',
                    'Light',
                    'Other'
                ]),
                labels = ['Any label'],
                i;
            for (i = 0; i < type.items.length; i++) {
                if (type.items[i].text === filters.type) {
                    type.selection = i;
                }
            }
            for (i = 0; i <= 16; i++) {
                labels.push('Label index ' + i);
            }
            var label = dropdown(d, labels);
            if (filters.label !== undefined && filters.label !== null) {
                label.selection = filters.label + 1;
            }
            var flags = [
                    'locked',
                    'enabled',
                    'shy',
                    'threeD',
                    'selected',
                    'adjustment'
                ],
                flagLabels = [
                    'Locked',
                    'Enabled',
                    'Shy',
                    '3D',
                    'Selected in AE',
                    'Adjustment'
                ],
                controls = [];
            for (i = 0; i < flags.length; i++) {
                var r = row(d);
                r.add('statictext', undefined, flagLabels[i]);
                controls.push(dropdown(r, ['Any', 'Yes', 'No']));
                if (filters[flags[i]] === true) {
                    controls[i].selection = 1;
                } else if (filters[flags[i]] === false) {
                    controls[i].selection = 2;
                }
            }
            var effect = d.add('edittext', undefined, filters.effect || '');
            effect.helpTip = 'Effect name or matchName contains';
            var presence = dropdown(d, [
                'Any effects / no effects',
                'Has effects',
                'No effects'
            ]);
            if (filters.effectMode === 'has') {
                presence.selection = 1;
            } else if (filters.effectMode === 'none') {
                presence.selection = 2;
            }
            var fxState = dropdown(d, [
                'Any effect state',
                'Effect enabled',
                'Effect disabled'
            ]);
            if (filters.effectEnabled === true) {
                fxState.selection = 1;
            } else if (filters.effectEnabled === false) {
                fxState.selection = 2;
            }
            var animation = dropdown(d, [
                'Any',
                'Static',
                'Animated',
                'Expression',
                'Partial'
            ]);
            animation.helpTip =
                'Uses known analysis metadata only; unknown is never Static.';
            for (i = 0; i < animation.items.length; i++) {
                if (animation.items[i].text === filters.animation) {
                    animation.selection = i;
                }
            }
            var propertyText = d.add(
                'statictext',
                undefined,
                propertyFilters.length
                    ? propertyFilters.length + ' property value filters active'
                    : 'No property value filter'
            );
            button(d, 'Property value...', function () {
                var s = selected().instances;
                FX.U.assert(
                    s.length,
                    'Select a scanned occurrence before choosing a property'
                );
                FX.U.assert(
                    s[0].configuration,
                    'Select an effect and use Read Parameters first. No analysis starts from this dialog.'
                );
                var ps = pickRows(
                    s[0].configuration,
                    'Choose properties for filtering'
                );
                if (ps) {
                    var pi, v;
                    for (pi = 0; pi < ps.length; pi++) {
                        v = prompt(
                            'Exact value for ' +
                                ps[pi].name +
                                ' (number or vector)',
                            FX.JSON.stringify(ps[pi].value)
                        );
                        if (v === null) {
                            return;
                        }
                        ps[pi].value = FX.JSON.parse(v);
                    }
                    FX.Validate.rows(ps);
                    propertyFilters = ps;
                    propertyText.text = ps.length + ' property filters active';
                }
            });
            var buttons = row(d);
            button(buttons, 'Clear', function () {
                filters = {};
                d.close(1);
                render();
            });
            button(buttons, 'Cancel', function () {
                d.close(0);
            });
            button(buttons, 'Use filters', function () {
                filters.property = null;
                filters.properties = propertyFilters;
                filters.animation = animation.selection.text;
                filters.compName = cn.text;
                filters.type = type.selection.text;
                filters.label = null;
                if (label.selection.index) {
                    filters.label = label.selection.index - 1;
                }
                for (var j = 0; j < flags.length; j++) {
                    filters[flags[j]] = null;
                    if (controls[j].selection.index) {
                        filters[flags[j]] = controls[j].selection.index === 1;
                    }
                }
                filters.effect = effect.text;
                filters.effectMode = ['any', 'has', 'none'][
                    presence.selection.index
                ];
                filters.effectEnabled = null;
                if (fxState.selection.index) {
                    filters.effectEnabled = fxState.selection.index === 1;
                }
                d.close(1);
                render();
            });
            showDialog(d);
        }
        function compareDialog() {
            FX.U.assert(
                scanner.inventory() &&
                    scanner.inventory().analysisState === 'analyzed',
                'Run Configuration Analysis before comparing configurations.'
            );
            var scan = scanner.current(),
                choices = FX.Grouping.build(
                    comparableInstances(),
                    'type-config',
                    null,
                    true
                );
            FX.U.assert(
                choices.length >= 2,
                'At least two configuration groups are needed'
            );
            var d = new Window('dialog', 'Compare configurations');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var a = dropdown(d, []),
                b = dropdown(d, []),
                i;
            for (i = 0; i < choices.length; i++) {
                var title =
                    choices[i].name +
                    ' / ' +
                    choices[i].layerType +
                    ' / ' +
                    FX.Presentation.groupTitle(choices[i]);
                a.add('item', 'A: ' + title);
                b.add('item', 'B: ' + title);
            }
            a.selection = 0;
            b.selection = 1;
            var showAll = d.add('checkbox', undefined, 'Show all properties'),
                list = d.add('listbox', undefined, [], {
                    multiselect: true,
                    numberOfColumns: 3,
                    showHeaders: true,
                    columnTitles: ['Property', 'A', 'B'],
                    columnWidths: [220, 110, 110]
                });
            list.preferredSize = [460, 260];
            var diff = [],
                copyIntent = null;
            function fill() {
                list.removeAll();
                if (!a.selection || !b.selection) {
                    return;
                }
                var ga = choices[a.selection.index],
                    gb = choices[b.selection.index];
                if (ga.matchName !== gb.matchName) {
                    list.add(
                        'item',
                        'Choose groups with the same effect matchName'
                    );
                    diff = [];
                    return;
                }
                diff = FX.Config.diff(
                    ga.instances[0].configuration,
                    gb.instances[0].configuration,
                    showAll.value
                );
                var j, n;
                for (j = 0; j < diff.length; j++) {
                    n = list.add('item', diff[j].name);
                    n.subItems[0].text = diff[j].a
                        ? FX.Parameters.display(diff[j].a)
                        : 'Unavailable';
                    n.subItems[1].text = diff[j].b
                        ? FX.Parameters.display(diff[j].b)
                        : 'Unavailable';
                }
            }
            a.onChange = fill;
            b.onChange = fill;
            showAll.onClick = fill;
            fill();
            function copy(reverse) {
                var s = list.selection || [],
                    rows = [],
                    j,
                    r;
                if (!FX.U.array(s)) {
                    s = [s];
                }
                for (j = 0; j < s.length; j++) {
                    r = diff[s[j].index];
                    FX.U.assert(
                        r && r.comparable,
                        'Only compatible static properties can be copied'
                    );
                    rows.push(FX.U.clone(reverse ? r.b : r.a));
                }
                FX.U.assert(rows.length, 'Select the parameters to copy');
                var dest =
                    choices[reverse ? a.selection.index : b.selection.index];
                copyIntent = { targets: dest.instances, rows: rows };
                d.close(1);
            }
            var r = row(d);
            button(r, 'Copy A → B', function () {
                copy(false);
            });
            button(r, 'Copy B → A', function () {
                copy(true);
            });
            button(r, 'Close', function () {
                d.close(0);
            });
            if (showDialog(d) === 1 && copyIntent && !disposed) {
                confirmAndExecute(copyIntent.targets, 'copy', {
                    rows: copyIntent.rows
                });
            }
        }
        function issuesDialog() {
            FX.U.assert(lastReport, 'No operation results');
            var d = new Window('dialog', 'Operation results');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var outcomeSummary = d.add('statictext', undefined, FX.Presentation.reportSummary(lastReport), { multiline: true });
            outcomeSummary.preferredSize = [440, 54];
            var list = d.add('listbox', undefined, []),
                i;
            list.preferredSize = [440, 130];
            list.visible = lastReport.issues.length > 0;
            list.maximumSize.height = list.visible ? 10000 : 0;
            var details = d.add(
                'edittext',
                undefined,
                FX.JSON.stringify(lastReport),
                { multiline: true, scrolling: true, readonly: true }
            );
            details.preferredSize = [440, 180];
            details.visible = false;
            details.maximumSize.height = 0;
            button(d, 'Technical details', function () {
                details.visible = !details.visible;
                details.maximumSize.height = details.visible ? 10000 : 0;
                d.layout.layout(true);
            });
            button(d, 'Save report...', function () {
                var file = File.saveDialog('Save operation report', 'JSON:*.json');
                if (file) { new FX.Store().writeText(file, FX.JSON.stringify(lastReport)); }
            });
            for (i = 0; i < lastReport.issues.length; i++) {
                var issue = lastReport.issues[i];
                list.add(
                    'item',
                    (issue.target
                        ? issue.target.compName + ' / ' + issue.target.layerName
                        : 'Batch') +
                        ': ' +
                        issue.reason
                );
            }
            button(d, 'Locate selected', function () {
                FX.U.assert(list.selection, 'Choose an issue');
                var target = lastReport.issues[list.selection.index].target;
                FX.U.assert(target, 'This is a batch-level issue.');
                adapter.locate(target);
            });
            button(d, 'Close', function () {
                d.close();
            });
            showDialog(d);
        }
        function diagnosticDialog() {
            var d = new Window('dialog', 'FX Exchanger diagnostics');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var text = d.add('edittext', undefined, diagnostics.text(), {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [420, 240];
            button(d, 'Save log...', function () {
                var file = File.saveDialog(
                    'Save diagnostic JSON',
                    'JSON:*.json'
                );
                if (file) {
                    var logStore = new FX.Store();
                    logStore.writeText(file, diagnostics.text());
                }
            });
            button(d, 'Close', function () {
                d.close();
            });
            showDialog(d);
        }
        scope.selection = 0;
        var i;
        for (i = 0; i < scopes.length; i++) {
            if (scopes[i] === state.preferences.scope) {
                scope.selection = i;
            }
        }
        groupBy.selection = 7;
        mainView.selection = 0;
        choose.enabled = scope.selection.index === 1;
        var controller = {
            root: shell,
            content: root,
            viewport: {
                resize: layoutViewport,
                scrollTo: scrollTo,
                state: function () {
                    return viewportState;
                }
            },
            scanner: scanner,
            adapter: adapter,
            batch: batch,
            results: tree,
            isPanel: isPanel,
            dispose: function () {
                if (disposed) {
                    return;
                }
                disposed = true;
                cancelEditorContinuation();
                pendingParameterRefresh = null;
                pendingRestore = null;
                sessionEpoch++;
                closeDialogs();
                scanner.cancel();
                diagnostics.add(
                    'lifecycle',
                    '',
                    'disposed; pending tasks cancelled'
                );
                scanner.onDone = scanner.onProgress = function () {};
                delete $.global[callback];
                delete $.global[editorCallback];
            },
            scan: guard(runScan, 'scan-start'),
            analyze: guard(analyzeSelection),
            editorTask: function () { return editorContinueTask; },
            render: render,
            diagnostics: diagnostics,
            applySearch: applySearch,
            selected: selected
        };
        w.fxController = controller;
        w.onClose = function () {
            controller.dispose();
            return true;
        };
        w.onResizing = w.onResize = guard(function () {
            w.layout.resize();
            layoutViewport();
        }, 'resize');
        layoutReady = true;
        body.layout = { layout: layoutViewport, resize: layoutViewport };
        updateActions();
        w.minimumSize = [280, 160];
        w.layout.layout(true);
        layoutViewport();
        if (!isPanel) {
            w.size = [480, 680];
            w.center();
            w.show();
        }
        if (startupFailed) {
            status.text =
                'Preferences could not be loaded; using defaults. See Help > Diagnostics.';
        }
        initializing = false;
        return w;
    }
    return { start: start };
})();

FX.UI.start(host);
}(this));
