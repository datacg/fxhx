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
