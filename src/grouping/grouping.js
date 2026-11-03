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
