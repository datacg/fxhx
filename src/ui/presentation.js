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
