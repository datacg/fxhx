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
            // Presentation hint only: values stay numeric 0/1 when written.
            r.toggle = !r.unknownValues && FX.Parameters.isToggle(r.row, r.values,
                instances.length ? instances[0].matchName : null);
            if (r.row && r.toggle) { r.row.toggle = true; }
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
                    'Select an effect, or choose View > Layers to add an effect to a layer.',
                same: true,
                analyzed: true
            },
            i,
            editable = false,
            j, states, properties, config, profile;
        if (!fresh) {
            out.action = 'scan';
            out.message = 'Choose a scope, then press Search (or Enter) to list its effects.';
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
            '1. Pick a Scope: Active Composition, Choose Compositions or Entire Project.\n2. Type an effect, layer or composition name in Find and press Enter (or Search). The first search lists the effects in the scope; later searches filter that list instantly.\n3. Refresh updates the list after you change the project. Cancel (same place) stops a running update.\n\nOpening the panel reads nothing. Parameter values are only read when you ask for them.'
        ],
        [
            'Edit parameters',
            'Select one or more effects of the same type and click Edit Parameters....\n\nLeft: find a parameter by name or value; filter Editable, Has keyframes, Pending changes or Unavailable.\nRight: the selected parameter, its current values and the New value field. Vectors show X/Y/Z; colors show R/G/B/A from 0 to 1, a hex field and Pick... for the system color picker. On/off parameters show a checkbox; Number... edits them as a number and Checkbox switches back. Decimal commas are accepted (20,5).\nBottom: every pending change. Apply N changes sends them in one batch after a confirmation that lists each parameter, its current values and the new value.\n\n* marks a pending change, ! a value to correct. Leave a field blank to keep each effect\'s value. Each pending change must apply to every selected effect; otherwise Apply is blocked and View targets explains why.'
        ],
        [
            'Keyframes',
            'Keyframes are never removed unless you check Remove keyframes for that parameter and confirm again with the key count. With the box checked, a blank value keeps each current value as a fixed value; a new value replaces all of them. Expressions, locked layers and protected fields are never changed. Inspect Animation... (More) is read-only.'
        ],
        [
            'Selection',
            'Click selects one result. Ctrl-click adds or removes; Shift-click selects a range; Ctrl+Shift adds a range. [x] marks selected rows, [-] a partially selected group. Select Results selects everything that matches the current search, including other pages. Double-click a group (or Left/Right) to collapse or expand it. Actions only use selected results that match the current search and filters.'
        ],
        [
            'Views and groups',
            'View > Effects lists each effect. Groups compares effects of the same type by their parameter values (read them first with More > Read Parameters). Layers also lists layers without effects, for Add Effect.... More > Grouping... chooses how groups are formed. Lists longer than 200 rows have Previous/Next pages.'
        ],
        [
            'Copy and presets',
            'More > Copy Parameters... copies chosen static values; select effects of the same type and use Paste Parameters.... Copy From Another Effect... applies values from a reference effect. Save Effect Preset... stores chosen values; Presets... edits (several values per save), renames, imports and exports them. Add Effect... > Saved presets adds a NEW effect with those values; existing effects are not replaced. Presets never contain animation or expressions.'
        ],
        [
            'More actions',
            'Enable, Disable and Add Effect... are on the panel. More... holds the rest: Read Parameters, Copy/Paste Parameters, Compare..., Inspect Animation..., Remove Effects, Selection..., Grouping..., Details... and Diagnostics.... Every change asks for confirmation; Enter in a confirmation cancels, so applying always needs a click.'
        ],
        [
            'Safety and Undo',
            'Every operation is one Undo step (Edit > Undo). Before writing, every target is checked again; after writing, each value is read back. Values that After Effects stores at its own precision (for example colors) are accepted; real rounding or clamping is reported. Uncertain writes are never retried automatically: open Results... and Refresh before trying again. After a successful edit the list is kept and only the edited effects are read again; Remove and Add Effect relist the scope.'
        ],
        [
            'Troubleshooting',
            'After Effects can pause while a long operation runs; the progress bar shows how far it got. Check for updates needs Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network and may pause AE for a few seconds; Open Releases always works. Locate selects the layer in one Timeline. Help > Diagnostics... lists technical events for bug reports; it contains no project values or license data.'
        ],
        [
            'Example: 18 Glows',
            'Find: Glow, Enter. Select Results. View > Groups, then More > Read Parameters: groups show Intensity 50 (3), 6 (12), 7 (3). Click group 7, Edit Parameters..., set Intensity to 6, Apply 1 change, Apply to 3 effects. The list refreshes; Radius and other effects stay unchanged.'
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
                // 3 control rows (3 x 32) + status and progress (42).
                fixed = 138 + 34 + 28 + action + direct + 12;
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
