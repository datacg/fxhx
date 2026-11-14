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
    // Accepts what people type in AE fields: "20", "-0.5", "20,5", " .5 ".
    // Rejects hex, exponents, thousands separators and empty text so a typo
    // never becomes a silent 0 or NaN.
    function parseNumber(text, label) {
        var s = trim(String(text === undefined || text === null ? '' : text)),
            prefix = label ? label + ': ' : '',
            n;
        if (/^[+-]?\d*,\d+$/.test(s)) {
            s = s.replace(',', '.');
        }
        assert(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s),
            prefix + 'enter a number such as 20 or 20.5');
        n = Number(s);
        assert(isFinite(n), prefix + 'number is too large');
        return n;
    }
    // Hosts may store values at reduced precision (for example float32 colors),
    // so a requested 0.2 can read back as 0.20000000298. Compare with a small
    // relative tolerance; structural differences still fail.
    function sameValue(a, b, tolerance) {
        var i, t = typeof tolerance === 'number' ? tolerance : 1e-5;
        if (array(a) || array(b)) {
            if (!array(a) || !array(b) || a.length !== b.length) {
                return false;
            }
            for (i = 0; i < a.length; i++) {
                if (!sameValue(a[i], b[i], t)) {
                    return false;
                }
            }
            return true;
        }
        if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b)) {
            return a === b;
        }
        return Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));
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
        hash: hash,
        parseNumber: parseNumber,
        sameValue: sameValue
    };
})();
