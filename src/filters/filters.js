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
