// ScriptUI parameter editor. Host reads and writes belong to the caller.
// Layout: parameter list on the left, inspector for the highlighted
// parameter on the right, pending changes and Apply along the bottom.
FX.Editor = (function () {
    function open(o) {
        var d = o.dialog, rows = o.rows, drafts = FX.U.clone(o.drafts || {}),
            active = null, loading = true, filling = false, shown = false,
            result = null, apply, updatingDrafts = false,
            validationErrors = [], invalidDrafts = {}, visibleRows = [];
        d.orientation = 'column';
        d.alignChildren = 'fill';
        d.minimumSize = [640, 360];
        d.add('statictext', undefined, FX.Presentation.effectName(o.instances[0]) +
            ' - ' + o.instances.length + ' effects / ' + o.layerCount + ' layers');
        var main = o.row(d);
        main.alignment = ['fill', 'fill'];
        main.alignChildren = ['fill', 'fill'];
        main.spacing = 10;
        // Left: find and choose a parameter.
        var left = main.add('group');
        left.orientation = 'column';
        left.alignment = ['fill', 'fill'];
        left.alignChildren = ['fill', 'top'];
        left.spacing = 4;
        var searchRow = o.row(left);
        var search = searchRow.add('edittext', undefined, '');
        search.fxParameterSearch = true;
        search.alignment = ['fill', 'center'];
        search.characters = 14;
        search.helpTip = 'Find parameter by name or value. Every word must match.';
        o.button(searchRow, 'Clear search', function () {
            search.text = '';
            rebuildList();
        });
        var filter = searchRow.add('dropdownlist', undefined,
            FX.I18N.list(['All parameters', 'Editable', 'Has keyframes', 'Pending changes', 'Unavailable']));
        filter.selection = 0;
        filter.fxParameterFilter = true;
        var count = left.add('statictext', undefined, ''),
            list = left.add('listbox', undefined, [], {
                numberOfColumns: 4, showHeaders: true,
                columnTitles: FX.I18N.list(['Parameter', 'Current', 'New value', 'Applies to']),
                columnWidths: [150, 80, 80, 66]
            });
        list.fxParameterList = true;
        list.alignment = ['fill', 'fill'];
        list.helpTip = '* = pending change. ! = invalid value. Search and filters preserve all pending changes.';
        list.preferredSize = [380, 250];
        left.add('statictext', undefined, FX.I18N.t('* pending change   ! needs correction'));
        // Right: inspector for the highlighted parameter.
        var inspector = main.add('panel', undefined, FX.I18N.t('Selected parameter'));
        inspector.orientation = 'column';
        inspector.alignment = ['fill', 'fill'];
        inspector.alignChildren = ['fill', 'top'];
        inspector.preferredSize.width = 330;
        inspector.margins = [10, 14, 10, 10];
        var title = inspector.add('statictext', undefined, '');
        try {
            title.graphics.font = ScriptUI.newFont(title.graphics.font.name, 'BOLD', title.graphics.font.size);
        } catch (ignoredFont) {}
        var current = inspector.add('statictext', undefined, '', { multiline: true });
        current.preferredSize = [310, 62];
        var previousValues = inspector.add('edittext', undefined, '', { multiline: true, scrolling: true, readonly: true });
        previousValues.preferredSize = [310, 44];
        previousValues.fxPreviousValues = true;
        var animationRow = o.row(inspector),
            removeAnimation = animationRow.add('checkbox', undefined, FX.I18N.t('Remove keyframes (all selected effects)'));
        removeAnimation.fxRemoveAnimation = true;
        removeAnimation.value = false;
        removeAnimation.helpTip = 'Clears the keyframes of this parameter in every selected effect. Blank value keeps each current value.';
        inspector.add('statictext', undefined, FX.I18N.t('New value'));
        var input = FX.ValueInput.create(inspector, {
            fieldFlag: 'fxParameterInput', menuFlag: 'fxParameterMenu',
            onError: function (error) {
                fieldHint.text = String(error.message || error);
            }
        });
        var fieldHint = inspector.add('statictext', undefined, '', { multiline: true });
        fieldHint.preferredSize = [310, 44];
        var inspectorActions = o.row(inspector);
        o.button(inspectorActions, 'View targets', showTargets);
        o.button(inspectorActions, 'Clear this change', function () {
            loading = true;
            removeAnimation.value = false;
            input.setRow(active ? active.row : null, null, null);
            loading = false;
            remember();
            load(active);
            rebuildList();
        });
        // Bottom: everything that Apply will send.
        var pendingTitle = d.add('statictext', undefined, ''),
            changes = d.add('listbox', undefined, [], {
                numberOfColumns: 3, showHeaders: true,
                columnTitles: FX.I18N.list(['Pending parameter', 'Previous -> New value', 'Action']),
                columnWidths: [160, 330, 200]
            });
        changes.fxPendingChanges = true;
        changes.preferredSize = [700, 74];
        var validation = d.add('statictext', undefined, '', { multiline: true });
        validation.preferredSize = [700, 32];
        var footer = o.row(d);
        footer.alignChildren = ['fill', 'center'];
        var applyHint = footer.add('statictext', undefined, FX.I18N.t('Apply closes the editor. To make more changes, use Edit Parameters again.'));
        applyHint.alignment = ['fill', 'center'];
        o.button(footer, 'Clear all changes', function () {
            drafts = {};
            save();
            load(active);
            rebuildList();
        });
        o.button(footer, 'Cancel', function () { remember(); d.close(0); });
        apply = o.button(footer, 'Apply', submit);
        apply.preferredSize.width = 120;
        apply.helpTip = 'Apply all pending changes after confirmation, then close the editor. The same safely recovered selection stays ready for Edit Parameters.';
        function key(r) { return '$' + FX.Config.key(r.path); }
        // Returns true when visibility actually changed (so layout is needed).
        function show(control, flag) {
            flag = !!flag;
            if (control.visible === flag && control.fxShown === flag) { return false; }
            control.visible = flag;
            control.fxShown = flag;
            control.maximumSize.height = flag ? 10000 : 0;
            return true;
        }
        function layout() {
            if (shown && !d.fxClosed) { d.layout.layout(true); }
        }
        function isMenu(r) { return !!(r && r.row && FX.ValueInput.isMenu(r.row)); }
        function canEdit(r) { return !!r && (r.safe || (removeAnimation.value && r.canRemoveKeyframes)); }
        function model(entry) {
            for (var n = 0; n < rows.length; n++) {
                if (FX.Config.key(rows[n].path) === FX.Config.key(entry.row.path)) { return rows[n]; }
            }
            return null;
        }
        function parse(entry) {
            var p = FX.U.clone(entry.row.row);
            if (entry.keepCurrent) {
                var r = model(entry);
                FX.U.assert(r && !r.unknownValues && r.values.length, 'Current values unavailable; enter a fixed value');
                p.value = FX.U.clone(r.values[0]);
                p.keepCurrent = true;
            } else if (p.control && p.control.kind === 'menu') {
                p.value = entry.menuValue;
            } else {
                p.value = FX.ValueInput.parse({ valueType: p.valueType, name: entry.row.name }, entry.texts);
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
        function setText(target, text) {
            if (target.text !== text) { target.text = text; }
        }
        function refreshDrafts() {
            if (updatingDrafts) { return; }
            updatingDrafts = true;
            var relayout = false;
            try {
                var k, item, entry, total = 0, r, applicable, invalid = {}, label, keys = [], same, n,
                    previousText, actionText;
                invalidDrafts = invalid;
                validationErrors = [];
                for (k in drafts) {
                    if (FX.U.own(drafts, k)) { keys.push(k); }
                }
                // Rebuilding a ListBox on every keystroke flickers in AE; only
                // rebuild when the set of pending parameters changes.
                same = changes.items.length === keys.length;
                for (n = 0; same && n < keys.length; n++) {
                    same = changes.items[n].fxDraftKey === keys[n];
                }
                if (!same) {
                    changes.removeAll();
                    for (n = 0; n < keys.length; n++) {
                        item = changes.add('item', drafts[keys[n]].row.name);
                        item.fxDraftKey = keys[n];
                    }
                }
                for (n = 0; n < keys.length; n++) {
                    k = keys[n];
                    entry = drafts[k];
                    item = changes.items[n];
                    r = model(entry);
                    previousText = (r ? r.previous : 'Unavailable') + ' -> ' + displayDraft(entry);
                    actionText = 'Set all selected effects';
                    if (entry.removeKeyframes) {
                        actionText = entry.keepCurrent ? 'Clear keys; keep each value' : 'Remove keys + set all values';
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
                        actionText = 'Invalid value - correct before Apply';
                        validationErrors.push(entry.row.name + ': ' + String(error.message || 'Invalid value'));
                    }
                    setText(item, entry.row.name);
                    setText(item.subItems[0], previousText);
                    setText(item.subItems[1], actionText);
                    item.helpTip = previousText;
                }
                pendingTitle.text = total + ' pending parameter changes. Apply sends all of them in one batch.';
                relayout = show(pendingTitle, total > 0) || relayout;
                relayout = show(changes, total > 0) || relayout;
                setText(validation, validationErrors.join('\n'));
                relayout = show(validation, validationErrors.length > 0) || relayout;
                for (n = 0; n < list.items.length; n++) {
                    r = list.items[n].fxEditorRow;
                    entry = drafts[key(r)];
                    label = '';
                    if (entry) { label = invalid[key(r)] ? '! ' : '* '; }
                    label += r.name;
                    setText(list.items[n], label);
                    setText(list.items[n].subItems[1], entry ? displayDraft(entry) : 'Keep original');
                    applicable = r.available;
                    if (entry && entry.removeKeyframes && r.canRemoveKeyframes) { applicable += r.removable; }
                    setText(list.items[n].subItems[2], (entry && applicable < r.total ? 'Blocked ' : '') + applicable + '/' + r.total);
                }
                updateTitle(active);
                apply.enabled = total > 0 && validationErrors.length === 0;
                setText(apply, FX.I18N.applyChanges(total));
            } finally { updatingDrafts = false; }
            if (relayout) { layout(); }
        }
        function remember() {
            if (loading || !active || d.fxClosed) { return; }
            var texts = input.texts(), any = input.hasText(), value = null;
            if (isMenu(active)) {
                value = input.menuChoice();
                any = value !== null;
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
            var entry = r ? drafts[key(r)] : null, c;
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
            input.setRow(r ? r.row : null, entry ? entry.texts : null, entry ? entry.menuValue : null,
                { current: r && r.values.length === 1 && !r.unknownValues ? r.values[0] : null });
            input.setEnabled(canEdit(r));
            fieldHint.text = 'Leave blank to keep each existing value.';
            if (r && r.removable) { fieldHint.text = 'With Remove keyframes checked: blank keeps each current value; a new value replaces all selected values.'; }
            if (input.isToggle()) {
                fieldHint.text = 'Check or uncheck to set every selected effect. Clear this change keeps each original value. Number... edits it as a number; Checkbox switches back.';
                if (r.removable) { fieldHint.text += ' With Remove keyframes checked and no click, each current value is kept.'; }
            }
            if (r && r.row && r.row.valueType === 'COLOR' && !isMenu(r)) { fieldHint.text += ' Colors use 0-1 per channel; type a hex color or use Pick.'; }
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
            var detail = o.createDialog(FX.I18N.t('Parameter occurrences')), table = detail.add('listbox', undefined, [], {
                numberOfColumns: 5, showHeaders: true,
                columnTitles: FX.I18N.list(['Composition', 'Layer', 'Effect', 'Status', 'Previous value']), columnWidths: [90, 110, 120, 230, 130]
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
        input.onChange(o.guard(remember, 'parameter-input'));
        removeAnimation.onClick = o.guard(function () {
            remember();
            input.setEnabled(canEdit(active));
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
        show(left, rows.length > 1);
        rebuildList();
        shown = true;
        d.onResizing = d.onResize = o.guard(function () { d.layout.resize(); }, 'editor-resize');
        return o.showDialog(d) === 1 ? result : null;
    }
    return { open: open };
})();
