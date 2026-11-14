// Pure description of a pending batch for the confirmation dialog.
// No ScriptUI or host access: the panel renders the returned data.
FX.Confirmation = (function () {
    function describe(targets, id, options, plan) {
        options = options || {};
        var title = {
                enable: 'Enable effects',
                disable: 'Disable effects',
                remove: 'Remove effects',
                apply: 'Add effect',
                copy: 'Copy settings',
                set: 'Change parameters'
            }[id] || id,
            description = '',
            changeRows = [],
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
                changeRows.push([
                    change.name,
                    from,
                    change.keepCurrent ? 'Keep each current value; clear keyframes' : FX.Parameters.display(change)
                ]);
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
        return {
            title: title,
            description: description,
            changeRows: changeRows,
            partial: partial
        };
    }
    return { describe: describe };
})();
