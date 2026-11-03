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
