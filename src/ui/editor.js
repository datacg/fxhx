// ScriptUI parameter editor. Host reads and writes belong to the caller.
FX.Editor = (function () {
    function open(o) {
        var d = o.dialog, rows = o.rows, drafts = FX.U.clone(o.drafts || {}),
            active = null, loading = true, filling = false, shown = false,
            result = null, fields = [], i, apply, updatingDrafts = false,
            validationErrors = [], invalidDrafts = {}, visibleRows = [];
        d.orientation = 'column';
        d.alignChildren = 'fill';
        d.minimumSize = [520, 280];
        d.add('statictext', undefined, FX.Presentation.effectName(o.instances[0]) +
            ' - ' + o.instances.length + ' effects / ' + o.layerCount + ' layers');
        var hint = d.add('statictext', undefined,
            '* marks a pending change; ! needs correction. Change several parameters, then Apply once. Blank values keep originals.',
            { multiline: true });
        hint.preferredSize = [600, 32];
        var searchRow = o.row(d);
        searchRow.add('statictext', undefined, 'Find parameter');
        var search = searchRow.add('edittext', undefined, '');
        search.fxParameterSearch = true;
        search.alignment = ['fill', 'center'];
        search.characters = 25;
        o.button(searchRow, 'Clear search', function () {
            search.text = '';
            rebuildList();
        });
        var filter = searchRow.add('dropdownlist', undefined,
            ['All parameters', 'Editable', 'Has keyframes', 'Pending changes', 'Unavailable']);
        filter.selection = 0;
        filter.fxParameterFilter = true;
        var count = d.add('statictext', undefined, ''),
            list = d.add('listbox', undefined, [], {
                numberOfColumns: 4, showHeaders: true,
                columnTitles: ['Parameter', 'Current value', 'New value', 'Applies to'],
                columnWidths: [205, 130, 125, 110]
            });
        list.fxParameterList = true;
        list.helpTip = '* = pending change. ! = invalid value. Search and filters preserve all pending changes.';
        list.preferredSize = [600, 132];
        var title = d.add('statictext', undefined, ''),
            current = d.add('statictext', undefined, '', { multiline: true });
        current.preferredSize = [600, 60];
        var previousValues = d.add('edittext', undefined, '', { multiline: true, scrolling: true, readonly: true });
        previousValues.preferredSize = [600, 44];
        previousValues.fxPreviousValues = true;
        var animationRow = o.row(d),
            removeAnimation = animationRow.add('checkbox', undefined, 'Remove keyframes (this parameter, all selected effects)');
        removeAnimation.fxRemoveAnimation = true;
        removeAnimation.value = false;
        var fieldRow = o.row(d);
        fieldRow.add('statictext', undefined, 'New value');
        // Stack alternative editors without collapsing their dimensions. A
        // zero-sized hidden EditText can retain that size after relayout in AE.
        var valueHost = fieldRow.add('group');
        valueHost.orientation = 'stack';
        valueHost.alignment = ['fill', 'center'];
        valueHost.alignChildren = ['fill', 'center'];
        valueHost.minimumSize.height = 24;
        var numberInputs = o.row(valueHost);
        numberInputs.alignChildren = ['left', 'center'];
        for (i = 0; i < 4; i++) {
            fields.push(numberInputs.add('edittext', undefined, ''));
            fields[i].characters = 9;
            fields[i].minimumSize = [78, 24];
            fields[i].fxParameterInput = true;
        }
        var menu = valueHost.add('dropdownlist', undefined, []);
        menu.fxParameterMenu = true;
        menu.minimumSize = [180, 24];
        menu.preferredSize.width = 230;
        var fieldHint = d.add('statictext', undefined, '', { multiline: true });
        fieldHint.preferredSize = [600, 30];
        var pendingTitle = d.add('statictext', undefined, ''),
            changes = d.add('listbox', undefined, [], {
                numberOfColumns: 3, showHeaders: true,
                columnTitles: ['Pending parameter', 'Previous -> New value', 'Action'],
                columnWidths: [140, 270, 190]
            });
        changes.fxPendingChanges = true;
        changes.preferredSize = [600, 60];
        var validation = d.add('statictext', undefined, '', { multiline: true });
        validation.preferredSize = [600, 32];
        var actions = o.row(d);
        o.button(actions, 'View targets', showTargets);
        o.button(actions, 'Clear this change', function () {
            loading = true;
            removeAnimation.value = false;
            for (var n = 0; n < fields.length; n++) { fields[n].text = ''; }
            menu.selection = 0;
            loading = false;
            remember();
            load(active);
            rebuildList();
        });
        o.button(actions, 'Clear all changes', function () {
            drafts = {};
            save();
            load(active);
            rebuildList();
        });
        var applyHint = d.add('statictext', undefined,
            'Apply updates the selected effects. To make more changes, use Edit Parameters again.');
        var footer = o.row(d);
        o.button(footer, 'Cancel', function () { remember(); d.close(0); });
        apply = o.button(footer, 'Apply', submit);
        apply.helpTip = 'Apply all pending changes after confirmation, then close the editor. The same safely recovered selection stays ready for Edit Parameters.';
        function key(r) { return '$' + FX.Config.key(r.path); }
        function show(control, flag) {
            control.visible = !!flag;
            control.maximumSize.height = flag ? 10000 : 0;
        }
        function layout() {
            if (shown && !d.fxClosed) { d.layout.layout(true); }
        }
        function isMenu(r) { return !!(r && r.row && r.row.control && r.row.control.kind === 'menu'); }
        function dimension(r) {
            if (!r || !r.row) { return 0; }
            if (r.row.valueType === 'OneD') { return 1; }
            if (r.row.valueType === 'COLOR') { return 4; }
            if (r.row.valueType === 'TwoD' || r.row.valueType === 'TwoD_SPATIAL') { return 2; }
            return 3;
        }
        function canEdit(r) { return !!r && (r.safe || (removeAnimation.value && r.canRemoveKeyframes)); }
        function model(entry) {
            for (var n = 0; n < rows.length; n++) {
                if (FX.Config.key(rows[n].path) === FX.Config.key(entry.row.path)) { return rows[n]; }
            }
            return null;
        }
        function parse(entry) {
            var p = FX.U.clone(entry.row.row), n, values = [], size = dimension(entry.row);
            if (entry.keepCurrent) {
                var r = model(entry);
                FX.U.assert(r && !r.unknownValues && r.values.length, 'Current values unavailable; enter a fixed value');
                p.value = FX.U.clone(r.values[0]);
                p.keepCurrent = true;
            } else if (p.control && p.control.kind === 'menu') {
                p.value = entry.menuValue;
            } else {
                for (n = 0; n < size; n++) {
                    FX.U.assert(/\S/.test(entry.texts[n] || ''), 'Enter every component for ' + entry.row.name);
                    values.push(Number(entry.texts[n]));
                }
                p.value = size === 1 ? values[0] : values;
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
        function refreshDrafts() {
            if (updatingDrafts) { return; }
            updatingDrafts = true;
            try {
                var k, item, entry, total = 0, r, applicable, invalid = {}, label;
                invalidDrafts = invalid;
                validationErrors = [];
                changes.removeAll();
                for (k in drafts) {
                    if (FX.U.own(drafts, k)) {
                        entry = drafts[k];
                        item = changes.add('item', entry.row.name);
                        item.fxDraftKey = k;
                        r = model(entry);
                        item.subItems[0].text = (r ? r.previous : 'Unavailable') + ' -> ' + displayDraft(entry);
                        item.helpTip = item.subItems[0].text;
                        item.subItems[1].text = 'Set all selected effects';
                        if (entry.removeKeyframes) {
                            item.subItems[1].text = entry.keepCurrent ? 'Clear keys; keep each value' : 'Remove keys + set all values';
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
                            item.subItems[1].text = 'Invalid value - correct before Apply';
                            validationErrors.push(entry.row.name + ': ' + String(error.message || 'Invalid value'));
                        }
                    }
                }
                pendingTitle.text = total + ' pending parameter changes. Apply sends all of them in one batch.';
                show(pendingTitle, total > 0);
                show(changes, total > 0);
                validation.text = validationErrors.join('\n');
                show(validation, validationErrors.length > 0);
                for (var n = 0; n < list.items.length; n++) {
                    r = list.items[n].fxEditorRow;
                    entry = drafts[key(r)];
                    label = '';
                    if (entry) { label = invalid[key(r)] ? '! ' : '* '; }
                    label += r.name;
                    if (list.items[n].text !== label) { list.items[n].text = label; }
                    list.items[n].subItems[1].text = entry ? displayDraft(entry) : 'Keep original';
                    applicable = r.available;
                    if (entry && entry.removeKeyframes && r.canRemoveKeyframes) { applicable += r.removable; }
                    list.items[n].subItems[2].text = (entry && applicable < r.total ? 'Blocked ' : '') + applicable + '/' + r.total;
                }
                updateTitle(active);
                apply.enabled = total > 0 && validationErrors.length === 0;
            } finally { updatingDrafts = false; }
            layout();
        }
        function remember() {
            if (loading || !active || d.fxClosed) { return; }
            var texts = [], n, any = false, value = null;
            for (n = 0; n < dimension(active); n++) {
                texts.push(fields[n].text);
                if (/\S/.test(fields[n].text)) { any = true; }
            }
            if (isMenu(active)) {
                value = menu.selection ? menu.selection.fxValue : null;
                any = typeof value === 'number';
                if (!any) { value = null; }
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
            var entry = r ? drafts[key(r)] : null, size = dimension(r), n, c, item;
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
            menu.removeAll();
            menu.add('item', 'Keep original values');
            menu.selection = 0;
            if (isMenu(r)) {
                for (n = 0; n < r.row.control.choices.length; n++) {
                    c = r.row.control.choices[n];
                    item = menu.add('item', c.label);
                    item.fxValue = c.value;
                    if (entry && entry.menuValue === c.value) { menu.selection = item; }
                }
            }
            menu.visible = isMenu(r);
            numberInputs.visible = !isMenu(r) && size > 0;
            menu.enabled = canEdit(r);
            for (n = 0; n < fields.length; n++) {
                fields[n].visible = !isMenu(r) && n < size;
                fields[n].enabled = canEdit(r);
                fields[n].text = entry && entry.texts[n] !== undefined ? entry.texts[n] : '';
            }
            fieldHint.text = 'Blank / Keep original leaves each existing value unchanged.';
            if (r && r.removable) { fieldHint.text = 'With Remove keyframes checked: blank keeps each current value; a new value replaces all selected values.'; }
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
            var detail = o.createDialog('Parameter occurrences'), table = detail.add('listbox', undefined, [], {
                numberOfColumns: 5, showHeaders: true,
                columnTitles: ['Composition', 'Layer', 'Effect', 'Status', 'Previous value'], columnWidths: [90, 110, 120, 230, 130]
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
        for (i = 0; i < fields.length; i++) { fields[i].onChanging = fields[i].onChange = o.guard(remember, 'parameter-input'); }
        menu.onChange = o.guard(remember, 'parameter-menu');
        removeAnimation.onClick = o.guard(function () {
            remember();
            for (var n = 0; n < fields.length; n++) { fields[n].enabled = canEdit(active); }
            menu.enabled = canEdit(active);
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
        show(searchRow, rows.length > 1);
        show(count, rows.length > 1);
        show(list, rows.length > 1);
        rebuildList();
        shown = true;
        d.onResizing = d.onResize = o.guard(function () { d.layout.resize(); }, 'editor-resize');
        return o.showDialog(d) === 1 ? result : null;
    }
    return { open: open };
})();
