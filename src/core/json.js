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
