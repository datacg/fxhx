FX.UI = (function () {
    function start(host, settings) {
        settings = settings || {};
        var isPanel = typeof Panel !== 'undefined' && host instanceof Panel;
        var w = isPanel
            ? host
            : new Window('palette', 'FX Exchanger ' + FX.Updates.installed, undefined, {
                  resizeable: true
              });
        if (w.fxController) {
            w.fxController.dispose();
            w.remove(w.fxController.root);
        }
        w.orientation = 'column';
        w.alignChildren = ['fill', 'fill'];
        var shell = w.add('group');
        shell.orientation = 'column';
        shell.alignment = ['fill', 'fill'];
        shell.alignChildren = ['fill', 'top'];
        shell.margins = 0;
        shell.spacing = 4;
        var header = row(shell);
        var body = shell.add('group');
        body.alignment = ['fill', 'fill'];
        body.minimumSize = [180, 80];
        var viewport = body.add('panel', undefined, '');
        viewport.margins = 0;
        var scrollBar = body.add('scrollbar', undefined, 0, 0, 1);
        scrollBar.stepdelta = 24;
        scrollBar.jumpdelta = 120;
        var root = viewport.add('group');
        root.alignment = ['fill', 'fill'];
        root.orientation = 'column';
        root.alignChildren = ['fill', 'top'];
        root.spacing = 5;
        root.margins = 6;
        var diagnostics = new FX.Diagnostics(),
            adapter =
                settings.adapter || new FX.AfterEffectsAdapter(diagnostics),
            scanner = new FX.Scanner(adapter),
            batch = new FX.Batch(adapter, scanner);
        diagnostics = adapter.diagnostics;
        var store = null,
            state = FX.Model.state(),
            filters = {},
            manualIds = [],
            paths = [],
            selectedEffects = {},
            selectedLayers = {},
            view = { layers: [], instances: [] },
            groups = [],
            busy = false,
            lastReport = null,
            sourceRows = null,
            disposed = false,
            ticking = false,
            lastRender = null,
            activeTarget = null,
            adding = false,
            rendering = false,
            selecting = false,
            renderInProgress = false,
            renderPending = false,
            presentationFailed = false,
            sessionEpoch = 0,
            displayQuery = '',
            searchPending = false,
            page = 0,
            pageSize = 200,
            groupCache = [],
            renderedNodes = [],
            expansion = {},
            activeNodeKey = null,
            activeEffectKey = null,
            pageEffects = {},
            refreshTargets = null,
            pendingRestore = null,
            pendingParameterRefresh = null,
            dialogs = [],
            editorDraft = null,
            lastEditorPath = null,
            editorContinueRequest = null,
            editorContinueTask = null,
            startupFailed = false,
            layoutReady = false,
            layoutBusy = false,
            scrollOffset = 0,
            viewportState = null,
            advancedChoice = 0,
            lastValidGroup = 7,
            initializing = true,
            viewSyncing = false,
            viewChanging = false,
            advancedDialogOpen = false;
        var selectionAnchor = null,
            selectionGesture = 0,
            consumedGesture = -1,
            consumedKey = null,
            gestureModifiers = null;
        var parameterClipboard = null,
            presetLibrary = null,
            effectPreset = null;
        try {
            if (!settings.noStorage) {
                store = new FX.Store();
                state = store.load();
            }
        } catch (storageError) {
            store = null;
            startupFailed = true;
            reportError('preferences-load', storageError);
        }
        function dimension(control, key, index, fallback) {
            var n;
            try {
                n = control.size[key];
                if (typeof n !== 'number') {
                    n = control.size[index];
                }
                if (typeof n === 'number' && isFinite(n) && n > 0) {
                    return n;
                }
            } catch (ignoredSize) {}
            return fallback;
        }
        function layoutRow(control, width, height) {
            var items = [],
                i,
                c,
                flex = -1,
                x = 0,
                widths = [],
                weights = [],
                fixed = 0,
                gap = 4;
            for (i = 0; i < control.children.length; i++) {
                c = control.children[i];
                if (c.visible !== false) {
                    items.push(c);
                }
            }
            if (!items.length) {
                return;
            }
            if (height > 28 && items.length > 2) {
                var split = 2,
                    start = 0,
                    line,
                    end,
                    j;
                if (items.length === 3) {
                    split = 1;
                }
                for (line = 0; line < 2; line++) {
                    end = items.length;
                    if (line === 0) {
                        end = split;
                    }
                    widths = FX.Presentation.rowWidths(
                        width,
                        line === 0 && split === 1 ? [1] : [1, 1],
                        gap
                    );
                    x = 0;
                    for (j = start; j < end; j++) {
                        items[j].bounds = [
                            x,
                            line * 32,
                            x + widths[j - start],
                            line * 32 + 28
                        ];
                        x += widths[j - start] + gap;
                    }
                    start = split;
                }
                return;
            }
            for (i = 0; i < items.length; i++) {
                c = items[i];
                if (c.type === 'dropdownlist' || c.type === 'edittext') {
                    flex = i;
                }
                weights.push(1);
            }
            if (control === actionRow) {
                weights[0] = 2;
            }
            if (flex >= 0) {
                for (i = 0; i < items.length; i++) {
                    if (i === flex) {
                        continue;
                    }
                    widths[i] = items[i].type === 'statictext' ? 38 : 64;
                    fixed += widths[i];
                }
                widths[flex] = Math.max(
                    20,
                    width - fixed - gap * (items.length - 1)
                );
            } else {
                widths = FX.Presentation.rowWidths(width, weights, gap);
            }
            for (i = 0; i < items.length; i++) {
                items[i].bounds = [x, 0, x + widths[i], 28];
                x += widths[i] + gap;
            }
        }
        function layoutViewport(width, height) {
            if (!layoutReady || layoutBusy || disposed) {
                return;
            }
            layoutBusy = true;
            try {
                if (typeof width === 'number' && typeof height === 'number') {
                    body.size = [width, height];
                }
                width = dimension(body, 'width', 0, 440);
                height = dimension(body, 'height', 1, 580);
                var state = FX.Presentation.viewport(
                        width,
                        height,
                        pager.visible,
                        reportText.visible,
                        resultsButton.visible
                    ),
                    inner = state.width - 12,
                    y = 6,
                    fy = 0,
                    i,
                    fields = [sr, searchRow, gr, scanRow];
                viewportState = state;
                scrollOffset = Math.max(
                    0,
                    Math.min(scrollOffset, state.maxScroll)
                );
                viewport.bounds = [0, 0, state.width, height];
                root.bounds = [
                    0,
                    -scrollOffset,
                    state.width,
                    state.contentHeight - scrollOffset
                ];
                scrollBar.bounds = [width - 16, 0, width, height];
                scrollBar.visible = state.scrollbar;
                scrollBar.enabled = state.scrollbar;
                scrollBar.maxvalue = Math.max(1, state.maxScroll);
                scrollBar.value = scrollOffset;
                scrollBar.jumpdelta = Math.max(24, height - 28);
                for (i = 0; i < fields.length; i++) {
                    fields[i].bounds = [0, fy, inner, fy + 28];
                    layoutRow(fields[i], inner, 28);
                    fy += 32;
                }
                status.bounds = [0, fy, inner, fy + 38];
                fy += 42;
                tree.control.bounds = [0, fy, inner, fy + state.treeHeight];
                find.bounds = [6, y, 6 + inner, y + fy + state.treeHeight];
                y += fy + state.treeHeight + 5;
                if (pager.visible) {
                    pager.bounds = [6, y, 6 + inner, y + 28];
                    layoutRow(pager, inner, 28);
                    y += 33;
                }
                summary.bounds = [6, y, 6 + inner, y + 34];
                y += 39;
                selectionRow.bounds = [6, y, 6 + inner, y + 28];
                layoutRow(selectionRow, inner, 28);
                y += 33;
                actionRow.bounds = [6, y, 6 + inner, y + state.actionHeight];
                layoutRow(actionRow, inner, state.actionHeight);
                y += state.actionHeight + 5;
                directRow.bounds = [6, y, 6 + inner, y + state.directHeight];
                layoutRow(directRow, inner, state.directHeight);
                y += state.directHeight + 5;
                if (reportText.visible) {
                    reportText.bounds = [6, y, 6 + inner, y + 70];
                }
                state.offset = scrollOffset;
            } finally {
                layoutBusy = false;
            }
        }
        function scrollTo(value) {
            if (
                disposed ||
                layoutBusy ||
                !viewportState ||
                typeof value !== 'number' ||
                !isFinite(value)
            ) {
                return;
            }
            layoutBusy = true;
            try {
                scrollOffset = Math.max(
                    0,
                    Math.min(value, viewportState.maxScroll)
                );
                scrollBar.value = scrollOffset;
                root.bounds = [
                    0,
                    -scrollOffset,
                    viewportState.width,
                    viewportState.contentHeight - scrollOffset
                ];
                viewportState.offset = scrollOffset;
            } finally {
                layoutBusy = false;
            }
        }
        function wheel(event) {
            if (
                disposed ||
                !viewportState ||
                !viewportState.scrollbar ||
                event.target === tree.control
            ) {
                return;
            }
            var step = FX.Presentation.wheelStep(event),
                before = scrollOffset;
            if (!step) {
                return;
            }
            scrollTo(scrollOffset + step);
            if (before !== scrollOffset) {
                if (event.preventDefault) {
                    event.preventDefault();
                }
                if (event.stopPropagation) {
                    event.stopPropagation();
                }
            }
        }
        scrollBar.helpTip =
            'Scroll panel controls. The results list scrolls independently. Native wheel delivery depends on the host.';
        scrollBar.onChanging = scrollBar.onChange = guard(function () {
            scrollTo(scrollBar.value);
        }, 'scroll');
        try {
            body.addEventListener('mousewheel', guard(wheel, 'wheel'), true);
        } catch (ignoredMouseWheel) {}
        try {
            body.addEventListener('wheel', guard(wheel, 'wheel'), true);
        } catch (ignoredWheel) {}
        body.addEventListener(
            'keydown',
            guard(function (event) {
                if (
                    event.target === tree.control ||
                    (event.target && event.target.type === 'edittext')
                ) {
                    return;
                }
                if (
                    event.keyName === 'Page_Down' ||
                    event.keyName === 'PageDown'
                ) {
                    scrollTo(scrollOffset + viewportState.height - 28);
                } else if (
                    event.keyName === 'Page_Up' ||
                    event.keyName === 'PageUp'
                ) {
                    scrollTo(scrollOffset - viewportState.height + 28);
                } else {
                    return;
                }
                if (event.preventDefault) {
                    event.preventDefault();
                }
            }, 'scroll-key')
        );
        function row(parent) {
            var g = parent.add('group');
            g.orientation = 'row';
            g.alignChildren = ['fill', 'center'];
            g.spacing = 4;
            return g;
        }
        function button(parent, title, fn) {
            var properties = {};
            if (title === 'Cancel' || title === 'Close') {
                properties.name = 'cancel';
            }
            if (title === 'Apply') {
                properties.name = 'ok';
            }
            var b = parent.add('button', undefined, title, properties);
            b.preferredSize.width = Math.max(
                43,
                Math.min(175, title.length * 6 + 16)
            );
            b.onClick = guard(fn, title);
            return b;
        }
        function closeDialogs() {
            var i;
            for (i = dialogs.length - 1; i >= 0; i--) {
                try {
                    dialogs[i].close(0);
                } catch (ignoredClose) {}
            }
        }
        function bindDialogEvents(control, dialog) {
            var names = ['onClick', 'onChange', 'onChanging'],
                i;
            function bind(fn, name) {
                var protectedCallback = guard(fn, 'dialog/' + name);
                return function () {
                    if (disposed || dialog.fxClosed) {
                        return;
                    }
                    return protectedCallback.apply(this, arguments);
                };
            }
            for (i = 0; i < names.length; i++) {
                if (typeof control[names[i]] === 'function') {
                    control[names[i]] = bind(control[names[i]], names[i]);
                }
            }
            for (i = 0; control.children && i < control.children.length; i++) {
                bindDialogEvents(control.children[i], dialog);
            }
        }
        function showDialog(d) {
            if (disposed || initializing) {
                return 0;
            }
            var previousClose = d.onClose,
                result;
            d.fxClosed = false;
            d.onClose = function () {
                d.fxClosed = true;
                if (previousClose) {
                    return previousClose();
                }
                return true;
            };
            dialogs.push(d);
            try {
                bindDialogEvents(d, d);
                d.layout.layout(true);
                d.center();
                result = d.show();
                return result;
            } finally {
                if (!d.fxClosed) {
                    try {
                        d.close(0);
                    } catch (ignoredClose) {}
                }
                dialogs.pop();
                if (!dialogs.length && renderPending && !disposed) {
                    renderPending = false;
                    render();
                }
            }
        }
        function dropdown(parent, items) {
            var d = parent.add('dropdownlist', undefined, items);
            d.alignment = ['fill', 'center'];
            d.preferredSize.width = 160;
            d.selection = 0;
            return d;
        }
        function reportError(operation, error) {
            // Every sink is independently guarded; never mask the original exception.
            var started = 0;
            try {
                started = FX.U.now();
            } catch (ignoredClock) {}
            try {
                diagnostics.error(operation, error);
            } catch (ignoredDiagnostic) {}
            try {
                if (!scanner.job && !batch.executing) {
                    busy = false;
                    scanButton.enabled = true;
                    cancelButton.enabled = false;
                }
                if (scanner.basic && scanner.basic.stale) {
                    updateActions();
                }
            } catch (ignoredRecoveryControls) {}
            try {
                status.text =
                    'Error - ' +
                    operation +
                    ' stopped. See Help > Diagnostics; retry explicitly.';
            } catch (ignoredStatus) {}
            try {
                diagnostics.measure('errorRecovery', FX.U.now() - started, 1);
            } catch (ignoredMetric) {}
        }
        function guard(fn, operation) {
            return function () {
                if (disposed) {
                    return;
                }
                try {
                    return fn.apply(this, arguments);
                } catch (error) {
                    closeDialogs();
                    reportError(operation || 'ui-callback', error);
                }
            };
        }
        function save() {
            if (store) {
                try {
                    store.save(state);
                } catch (e) {
                    reportError('preferences-save', e);
                }
            }
        }
        header.add('statictext', undefined, 'FX Exchanger');
        var headerSpace = header.add('group');
        headerSpace.alignment = ['fill', 'center'];
        headerSpace.minimumSize = [0, 0];
        var helpButton = button(header, 'Help', helpDialog);
        helpButton.alignment = ['right', 'center'];
        helpButton.helpTip =
            'Help and Diagnostics (version is available there).';
        var find = root.add('group');
        find.alignment = ['fill', 'fill'];
        find.orientation = 'column';
        find.alignChildren = ['fill', 'top'];
        find.spacing = 4;
        find.margins = 0;
        var sr = row(find);
        sr.add('statictext', undefined, 'Scope');
        var scope = dropdown(sr, [
            'Active Composition',
            'Choose Compositions',
            'Entire Project'
        ]);
        var scopes = ['active', 'manual', 'entire'],
            modes = [
                'type-config',
                'effect',
                'type',
                'config',
                'selected',
                'composition',
                'layers',
                'occurrences'
            ];
        var choose = button(sr, 'Choose...', function () {
            var comps = adapter.compositions(),
                d = new Window('dialog', 'Choose compositions');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var query = d.add('edittext', undefined, ''),
                list = d.add('listbox', undefined, [], { multiselect: true }),
                count = d.add('statictext', undefined, ''),
                chosen = {},
                i;
            query.helpTip =
                'Find compositions by name; selections hidden by search are preserved.';
            list.preferredSize = [360, 240];
            for (i = 0; i < manualIds.length; i++) {
                chosen['$' + manualIds[i]] = true;
            }
            function remember() {
                var j;
                for (j = 0; j < list.items.length; j++) {
                    chosen['$' + list.items[j].compId] = list.items[j].selected;
                }
                updateCount();
            }
            function updateCount() {
                var j,
                    n = 0;
                for (j = 0; j < comps.length; j++) {
                    if (chosen['$' + comps[j].id]) {
                        n++;
                    }
                }
                count.text = n + ' composition(s) selected';
            }
            function fill() {
                list.removeAll();
                var j, item;
                for (j = 0; j < comps.length; j++) {
                    if (FX.Filters.text(comps[j].name, query.text)) {
                        item = list.add(
                            'item',
                            comps[j].name + ' [ID ' + comps[j].id + ']'
                        );
                        item.compId = comps[j].id;
                        item.selected = !!chosen['$' + item.compId];
                    }
                }
                updateCount();
            }
            query.onChanging = function () {
                remember();
                fill();
            };
            list.onChange = remember;
            var r = row(d);
            button(r, 'Select All', function () {
                var j;
                for (j = 0; j < list.items.length; j++) {
                    list.items[j].selected = true;
                }
                remember();
            });
            button(r, 'Clear Selection', function () {
                chosen = {};
                fill();
            });
            button(r, 'Cancel', function () {
                d.close(0);
            });
            button(r, 'Use selection', function () {
                remember();
                var ids = [],
                    j;
                for (j = 0; j < comps.length; j++) {
                    if (chosen['$' + comps[j].id]) {
                        ids.push(comps[j].id);
                    }
                }
                FX.U.assert(ids.length, 'Choose at least one composition.');
                if (
                    manualIds.length &&
                    FX.JSON.stringify(ids) !== FX.JSON.stringify(manualIds) &&
                    !confirm(
                        'Replace the previous composition selection with ' +
                            ids.length +
                            ' composition(s)?'
                    )
                ) {
                    return;
                }
                manualIds = ids;
                d.close(1);
            });
            fill();
            if (showDialog(d) === 1) {
                scope.selection = 1;
                invalidateScope();
            }
        });
        var searchRow = row(find);
        searchRow.add('statictext', undefined, 'Find');
        var search = searchRow.add('edittext', undefined, '');
        search.helpTip =
            'Search or Enter inventories the scope if needed, then filters in memory. Initial parameter reads are explicit; successful parameter edits update the same selection automatically.';
        search.characters = 10;
        search.alignment = ['fill', 'center'];
        search.minimumSize.width = 50;
        var searchButton = button(searchRow, 'Search', searchProject);
        button(searchRow, 'Clear', function () {
            search.text = '';
            applySearch();
        });
        var gr = row(find);
        gr.add('statictext', undefined, 'View');
        var groupBy = dropdown(gr, [
            'Configuration groups (advanced)',
            'Effect groups',
            'Effect and layer type groups',
            'Full configuration groups',
            'Selected parameter groups',
            'Composition and configuration groups',
            'Layers (including without effects)',
            'Effects (individual instances)'
        ]);
        groupBy.visible = false;
        groupBy.maximumSize = [0, 0];
        var mainView = dropdown(gr, ['Effects', 'Groups', 'Layer']);
        mainView.helpTip =
            'Groups compares configurations after Read Parameters. Layer includes empty layers. Configure grouping in More > Grouping...';
        var parameterGroup = button(gr, 'Parameters...', function () {
            chooseGrouping();
        });
        var presetsButton = button(gr, 'Presets...', presetDialog);
        var scanRow = row(find);
        button(scanRow, 'Filters...', filterDialog);
        var scanButton = button(scanRow, 'Scan', function () {
                runScan(scanner.basic && scanner.basic.stale);
            }),
            cancelButton = button(scanRow, 'Cancel', function () {
                cancelEditorContinuation();
                var updatingAfterEdit = !!pendingParameterRefresh ||
                    !!(pendingRestore && pendingRestore.readParameters);
                sessionEpoch++;
                pendingParameterRefresh = null;
                pendingRestore = null;
                scanner.cancel();
                busy = false;
                scanButton.enabled = true;
                cancelButton.enabled = false;
                render();
                updateActions();
                status.text =
                    'Cancelled - inventory preserved when available. Select effects to analyze.';
                if (updatingAfterEdit) {
                    status.text = 'Changes were applied. Updating was cancelled; review Results and refresh/read parameters to continue.';
                }
            });
        scanButton.helpTip =
            'Basic Scan only: existing effect identities, no property values.';
        groupBy.helpTip =
            'Effects lists individual instances. Layers includes empty layers. Other options are optional groups; changing View never reads parameters.';
        cancelButton.helpTip =
            'Cancel queued work without publishing partial configurations.';
        cancelButton.enabled = false;
        var status = find.add(
            'statictext',
            undefined,
            'Choose a scope, then Search or Scan. Parameters are read only on request.',
            { multiline: true }
        );
        status.preferredSize.height = 38;
        var tree = new FX.Results(find);
        tree.control.alignment = ['fill', 'fill'];
        tree.control.preferredSize = [300, 230];
        tree.control.minimumSize = [180, 90];
        tree.control.helpTip =
            'Selected results are highlighted. Ctrl toggles; Shift selects a range. Double-click a group, or use Left/Right, to collapse/expand.';
        tree.onExpand = guard(function () {
            refreshMarks(tree);
        }, 'results-expand');
        var nativeResultChange = tree.control.onChange;
        tree.control.onChange = guard(function () {
            try {
                nativeResultChange();
            } catch (selectionError) {
                lastRender = null;
                presentationFailed = true;
                tree.control.enabled = false;
                updateActions();
                throw selectionError;
            }
        }, 'result-native-selection');
        function selectionModifiers(event) {
            var keys = {};
            try {
                if (typeof ScriptUI !== 'undefined') {
                    keys = ScriptUI.environment.keyboardState;
                }
            } catch (ignoredKeys) {}
            return {
                ctrl: !!(
                    (event && (event.ctrlKey || event.metaKey)) ||
                    keys.ctrlKey ||
                    keys.metaKey
                ),
                shift: !!((event && event.shiftKey) || keys.shiftKey)
            };
        }
        function markSelection(data, flag) {
            var i;
            for (i = 0; i < data.instances.length; i++) {
                selectedEffects['$' + FX.Model.effectKey(data.instances[i])] =
                    flag;
            }
            for (i = 0; i < data.layers.length; i++) {
                selectedLayers['$' + FX.Model.layerKey(data.layers[i])] = flag;
            }
        }
        function selectionMark(data) {
            var count = 0,
                total = data.instances.length + data.layers.length,
                i;
            for (i = 0; i < data.instances.length; i++) {
                if (
                    selectedEffects['$' + FX.Model.effectKey(data.instances[i])]
                ) {
                    count++;
                }
            }
            for (i = 0; i < data.layers.length; i++) {
                if (selectedLayers['$' + FX.Model.layerKey(data.layers[i])]) {
                    count++;
                }
            }
            if (count === total && total) {
                return '[x] ';
            }
            if (count) {
                return '[-] ';
            }
            return '[ ] ';
        }
        function selectTreeItem(event) {
            if (
                busy ||
                renderInProgress ||
                dialogs.length ||
                rendering ||
                selecting
            ) {
                return;
            }
            var item = tree.selection,
                key,
                i,
                data,
                modifiers = gestureModifiers || selectionModifiers(event);
            if (!item || !item.fxData) {
                return;
            }
            if (
                !searchPending &&
                !adding &&
                consumedGesture === selectionGesture &&
                consumedKey === item.fxNodeKey
            ) {
                return;
            }
            selecting = true;
            try {
                key = item.fxNodeKey;
                if (searchPending) {
                    if (!applySearch()) {
                        return;
                    }
                    item = null;
                    for (i = 0; i < renderedNodes.length; i++) {
                        if (renderedNodes[i].fxNodeKey === key) {
                            item = renderedNodes[i];
                            break;
                        }
                    }
                    if (!item) {
                        clearSelection();
                        status.text =
                            'Search applied. Select a matching result.';
                        return;
                    }
                    tree.selection = item;
                }
                data = item.fxData;
                activeTarget = data;
                activeNodeKey = item.fxNodeKey;
                activeEffectKey =
                    data.instances.length === 1
                        ? FX.Model.effectKey(data.instances[0])
                        : null;
                if (!adding && !modifiers.ctrl) {
                    selectedEffects = {};
                    selectedLayers = {};
                }
                var anchor = -1,
                    end = -1,
                    start,
                    row,
                    parent,
                    visible;
                if (modifiers.shift && selectionAnchor) {
                    for (i = 0; i < renderedNodes.length; i++) {
                        if (renderedNodes[i].fxNodeKey === selectionAnchor) {
                            anchor = i;
                        }
                        if (renderedNodes[i] === item) {
                            end = i;
                        }
                    }
                }
                if (anchor >= 0 && end >= 0) {
                    start = Math.min(anchor, end);
                    end = Math.max(anchor, end);
                    for (i = start; i <= end; i++) {
                        row = renderedNodes[i];
                        visible = true;
                        parent = row.fxParentNode;
                        while (parent) {
                            if (parent.expanded === false) {
                                visible = false;
                                break;
                            }
                            parent = parent.fxParentNode;
                        }
                        if (
                            visible &&
                            ((item.fxLeaf && row.fxLeaf) ||
                                (!item.fxLeaf &&
                                    row.fxDepth === item.fxDepth &&
                                    !row.fxLeaf))
                        ) {
                            markSelection(row.fxData, true);
                        }
                    }
                } else {
                    markSelection(
                        data,
                        modifiers.ctrl ? selectionMark(data) !== '[x] ' : true
                    );
                    selectionAnchor = item.fxNodeKey;
                    tree.anchor = item;
                }
                consumedKey = item.fxNodeKey;
                consumedGesture = selectionGesture;
                adding = false;
                refreshMarks(tree);
                updateActions();
            } finally {
                selecting = false;
            }
        }
        tree.onChange = guard(selectTreeItem, 'result-selection');
        tree.addEventListener(
            'mousedown',
            guard(function (event) {
                selectionGesture++;
                gestureModifiers = selectionModifiers(event);
            }, 'selection-gesture'),
            true
        );
        tree.addEventListener(
            'keydown',
            guard(function (event) {
                if (
                    /^(Up|Down|Left|Right|Home|End|PageUp|PageDown|Page_Up|Page_Down)$/.test(
                        event.keyName || ''
                    )
                ) {
                    selectionGesture++;
                }
                gestureModifiers = selectionModifiers(event);
            }, 'selection-key'),
            true
        );
        tree.addEventListener(
            'click',
            guard(function (event) {
                try {
                    selectTreeItem(event);
                } finally {
                    gestureModifiers = null;
                }
            }, 'result-click')
        );
        var pager = row(root),
            previousPage = button(pager, 'Previous', function () {
                page = Math.max(0, page - 1);
                lastRender = null;
                render();
            }),
            pageText = pager.add('statictext', undefined, ''),
            nextPage = button(pager, 'Next', function () {
                page++;
                lastRender = null;
                render();
            });
        pager.visible = false;
        pager.maximumSize.height = 0;
        var summary = root.add('statictext', undefined, '0 effects selected', {
            multiline: true
        });
        summary.preferredSize.height = 34;
        var selectionRow = row(root);
        var selectResultsButton = button(
            selectionRow,
            'Select Results',
            function () {
                if (searchPending && !applySearch()) {
                    return;
                }
                setAll(true);
            }
        );
        button(selectionRow, 'Clear Selection', clearSelection);
        var actionRow = row(root);
        var primaryButton = button(actionRow, 'Scan', primaryAction);
        var locateButton = button(actionRow, 'Locate', locateSelection);
        var directRow = row(root);
        var enableButton = button(directRow, 'Enable', function () {
            confirmAndExecute(selected().instances, 'enable', {});
        });
        var disableButton = button(directRow, 'Disable', function () {
            confirmAndExecute(selected().instances, 'disable', {});
        });
        var addButton = button(directRow, 'Add Effect...', function () {
            var targets = selected().layers;
            FX.U.assert(
                targets.length,
                'Select an effect occurrence or switch View to Layers.'
            );
            effectMatchName = '';
            effectPreset = null;
            chooseEffect();
            if (effectMatchName) {
                confirmAndExecute(targets, 'apply', {
                    matchName: effectMatchName,
                    displayName: effectDisplayName,
                    rows: effectPreset ? effectPreset.rows : null,
                    presetName: effectPreset ? effectPreset.name : ''
                });
            }
        });
        var actionsButton = button(directRow, 'More...', actionsDialog);
        var resultsButton = button(actionRow, 'Results...', issuesDialog);
        resultsButton.enabled = false;
        var reportText = root.add('statictext', undefined, '', {
            multiline: true
        });
        reportText.preferredSize.height = 70;
        reportText.visible = false;
        reportText.maximumSize.height = 0;
        var effectMatchName = '',
            effectDisplayName = '';
        function analyzeSelection() {
            if (disposed || busy || renderInProgress || dialogs.length) {
                return;
            }
            var chosen = selected().instances,
                targets = [],
                ti;
            for (ti = 0; ti < chosen.length; ti++) {
                if (!chosen[ti].configuration) {
                    targets.push(chosen[ti]);
                }
            }
            if (!targets.length) {
                updateActions();
                return;
            }
            FX.U.assert(
                targets.length,
                'Select an effect or group to continue.'
            );
            scanner.analyze(currentFilters(), targets);
            sessionEpoch++;
            beginWork();
        }
        function primaryAction() {
            if (presentationFailed) {
                render();
                return;
            }
            var choice = FX.Presentation.selectionState(
                selected(),
                scanner.basic && !scanner.basic.stale
            );
            if (choice.action === 'scan') {
                runScan(true);
            } else if (choice.action === 'analyze') {
                if (choice.same) { requestEditorContinuation(selected().instances); }
                analyzeSelection();
            } else if (choice.action === 'edit') {
                editParameters();
            }
        }
        function clearSelection() {
            cancelEditorContinuation();
            selectionAnchor = null;
            tree.anchor = null;
            consumedKey = null;
            selectedEffects = {};
            selectedLayers = {};
            activeTarget = null;
            activeEffectKey = null;
            adding = false;
            rendering = true;
            tree.selection = null;
            rendering = false;
            refreshMarks(tree);
            updateActions();
        }
        function selectionDialog() {
            var d = new Window('dialog', 'Operation selection');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                'These actions affect visible results only.'
            );
            button(d, 'Select All', function () {
                setAll(true);
                d.close(1);
            });
            button(d, 'Clear Selection', function () {
                clearSelection();
                d.close(1);
            });
            button(d, 'Invert Selection', function () {
                setAll(null);
                d.close(1);
            });
            button(d, 'Remove highlighted', function () {
                toggleNode(false);
                d.close(1);
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function helpDialog() {
            var d = new Window('dialog', 'FX Exchanger Help');
            var installedVersion = FX.Updates.installed;
            d.add('statictext', undefined, 'FX Exchanger ' + installedVersion);
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var index = dropdown(d, []),
                i;
            for (i = 0; i < FX.Presentation.help.length; i++) {
                index.add('item', FX.Presentation.help[i][0]);
            }
            var text = d.add('edittext', undefined, '', {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [440, 300];
            index.onChange = function () {
                if (index.selection) {
                    text.text = FX.Presentation.help[index.selection.index][1];
                }
            };
            index.selection = 0;
            index.onChange();
            var updateStatus = d.add('statictext', undefined,
                'Check GitHub for a newer version. Only runs when you click Check for updates.', { multiline: true });
            updateStatus.preferredSize = [440, 42];
            updateStatus.fxUpdateStatus = true;
            var updateActions = row(d), checkingUpdates = false,
                checkUpdates = button(updateActions, 'Check for updates', function () {
                    if (checkingUpdates || disposed) { return; }
                    checkingUpdates = true;
                    checkUpdates.enabled = false;
                    updateStatus.text = 'Checking GitHub...';
                    try {
                        d.update();
                    } catch (ignoredUpdatePaint) {}
                    try {
                        var release = adapter.checkForUpdates(installedVersion);
                        if (release.unpublished) {
                            updateStatus.text = 'No published release is available yet. Installed: ' + installedVersion + '.';
                        } else if (release.available) {
                            updateStatus.text = 'Update available: ' + release.version + ' (installed: ' + installedVersion + '). Open Releases to download it.';
                        } else {
                            updateStatus.text = 'You are up to date. Installed: ' + installedVersion + '; latest release: ' + release.version + '.';
                        }
                    } catch (updateError) {
                        updateStatus.text = 'Could not check for updates. Check your connection or open Releases in your browser.';
                        diagnostics.error('check-updates', updateError);
                    } finally {
                        checkingUpdates = false;
                        checkUpdates.enabled = true;
                    }
                });
            button(updateActions, 'Open Releases', function () {
                try { adapter.openReleases(); }
                catch (browserError) { updateStatus.text = 'Open https://github.com/datacg/fxhx/releases in your browser.'; }
            });
            var openDiagnostics = false;
            button(d, 'Diagnostics...', function () {
                openDiagnostics = true;
                d.close(1);
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
            if (openDiagnostics) {
                diagnosticDialog();
            }
        }
        function locateSelection() {
            var scan = scanner.current(),
                records = selected().layers,
                n = tree.selection;
            if (!records.length && n && n.fxData) {
                records = n.fxData.instances.concat(n.fxData.layers);
            }
            FX.U.assert(records.length, 'Highlight or select a result first.');
            var comps = [],
                seen = {},
                i,
                chosen = records[0].compId;
            for (i = 0; i < records.length; i++) {
                if (!seen['$' + records[i].compId]) {
                    seen['$' + records[i].compId] = true;
                    comps.push(records[i]);
                }
            }
            if (comps.length > 1) {
                var d = new Window('dialog', 'Choose Timeline composition');
                d.orientation = 'column';
                d.alignChildren = 'fill';
                d.add(
                    'statictext',
                    undefined,
                    'Only the chosen composition Timeline will be selected.'
                );
                var list = dropdown(d, []);
                for (i = 0; i < comps.length; i++) {
                    list.add(
                        'item',
                        comps[i].compName + ' [ID ' + comps[i].compId + ']'
                    );
                }
                list.selection = 0;
                button(d, 'Locate', function () {
                    chosen = comps[list.selection.index].compId;
                    d.close(1);
                });
                button(d, 'Cancel', function () {
                    d.close(0);
                });
                if (showDialog(d) !== 1) {
                    return;
                }
            }
            var targets = [],
                done = {},
                key,
                j;
            try {
                for (i = 0; i < records.length; i++) {
                    if (records[i].compId !== chosen) {
                        continue;
                    }
                    key = '$' + FX.Model.layerKey(records[i]);
                    if (done[key]) {
                        continue;
                    }
                    for (j = 0; j < scan.layers.length; j++) {
                        if (
                            FX.Model.layerKey(scan.layers[j]) ===
                            FX.Model.layerKey(records[i])
                        ) {
                            adapter.validateLayer(scan.layers[j], true);
                        }
                    }
                    done[key] = true;
                    targets.push(records[i]);
                }
                adapter.selectLayers(targets);
                if (targets.length === 1 && targets[0].effectIndex) {
                    adapter.locate(targets[0]);
                }
                status.text =
                    'Located ' +
                    targets.length +
                    ' layers in ' +
                    targets[0].compName +
                    ' only.';
            } catch (error) {
                scanner.invalidate();
                throw error;
            }
        }
        function comparableInstances() {
            var chosen = selected().instances,
                match = chosen.length ? chosen[0].matchName : null,
                out = [],
                i;
            for (i = 0; i < view.instances.length; i++) {
                if (!match && view.instances[i].configuration) {
                    match = view.instances[i].matchName;
                }
                if (
                    view.instances[i].configuration &&
                    (!match || view.instances[i].matchName === match)
                ) {
                    out.push(view.instances[i]);
                }
            }
            return out;
        }
        function detailsDialog() {
            var n = tree.selection,
                s = selected().instances,
                e;
            if (n && n.fxData && n.fxData.instances.length) {
                e = n.fxData.instances[0];
            } else if (s.length) {
                e = s[0];
            }
            FX.U.assert(e, 'Highlight an effect occurrence first.');
            var d = new Window('dialog', 'Effect details');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var data =
                'Instance: ' +
                FX.Presentation.effectName(e) +
                '\nmatchName: ' +
                e.matchName +
                '\nComposition: ' +
                e.compName +
                ' [ID ' +
                e.compId +
                ']\nLayer: ' +
                e.layerName +
                '\nEffect index: ' +
                e.effectIndex +
                '\nEnabled: ' +
                e.enabled +
                '\nAnalysis: ' +
                e.analysisState;
            if (e.fingerprint) {
                data +=
                    '\nCanonical hash: ' +
                    e.fingerprint.hash +
                    '\nComparable: ' +
                    e.fingerprint.comparable +
                    '\nUnsupported: ' +
                    e.fingerprint.unsupported;
            }
            var text = d.add('edittext', undefined, data, {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [420, 260];
            button(d, 'Look up registered name', function () {
                var all = adapter.inventory(),
                    i;
                for (i = 0; i < all.length; i++) {
                    if (all[i].matchName === e.matchName) {
                        text.text =
                            data + '\nRegistered name: ' + all[i].displayName;
                        return;
                    }
                }
                text.text = data + '\nRegistered name unavailable.';
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function animationDialog() {
            var targets = selected().instances,
                scan = scanner.current(),
                i,
                j;
            FX.U.assert(
                targets.length > 0 && targets.length <= 2,
                'Select one occurrence to inspect, or two of the same effect to compare.'
            );
            for (i = 0; i < targets.length; i++) {
                FX.U.assert(
                    targets[i].configuration &&
                        targets[i].matchName === targets[0].matchName,
                    'Analyze selected occurrences of the same effect first.'
                );
            }
            var states = targets[0].configuration.states || [],
                d = new Window('dialog', 'Animation Inspection');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                'Read only: choose property paths, then Inspect Selected. No keyframe writes.'
            );
            var list = d.add('listbox', undefined, [], { multiselect: true });
            list.preferredSize = [460, 110];
            for (i = 0; i < states.length; i++) {
                list.add(
                    'item',
                    (states[i].name ||
                        states[i].path[states[i].path.length - 1].matchName) +
                        ' / ' +
                        states[i].state
                );
            }
            var keyTable = d.add('listbox', undefined, [], {
                numberOfColumns: 4,
                showHeaders: true,
                columnTitles: ['Key', 'Time (s)', 'Value', 'Curve'],
                columnWidths: [55, 85, 170, 150]
            });
            keyTable.preferredSize = [460, 150];
            var text = d.add(
                'edittext',
                undefined,
                'No detailed keyframes read yet.',
                { multiline: true, scrolling: true, readonly: true }
            );
            text.preferredSize = [460, 130];
            keyTable.onChange = function () {
                if (keyTable.selection) {
                    text.text = FX.JSON.stringify(
                        keyTable.selection.fxKeyMetadata
                    );
                }
            };
            button(d, 'Inspect Selected', function () {
                scanner.current();
                keyTable.removeAll();
                var paths = [],
                    captures = [],
                    lines = [],
                    t,
                    layer = null,
                    s,
                    n,
                    key;
                for (s = 0; s < list.items.length; s++) {
                    if (list.items[s].selected) {
                        paths.push(states[s].path);
                    }
                }
                FX.U.assert(
                    paths.length > 0 && paths.length <= 16,
                    'Choose 1 to 16 paths for this inspection.'
                );
                for (t = 0; t < targets.length; t++) {
                    layer = null;
                    for (s = 0; s < scan.layers.length; s++) {
                        if (
                            FX.Model.layerKey(scan.layers[s]) ===
                            FX.Model.layerKey(targets[t])
                        ) {
                            layer = scan.layers[s];
                        }
                    }
                    captures.push(
                        adapter.inspectAnimation(targets[t], paths, layer)
                    );
                    lines.push(
                        (t === 0 ? 'A: ' : 'B: ') +
                            targets[t].compName +
                            ' / ' +
                            targets[t].layerName +
                            ' / #' +
                            targets[t].effectIndex
                    );
                    for (s = 0; s < captures[t].length; s++) {
                        var item = captures[t][s];
                        lines.push(
                            'Property: ' +
                                item.path[item.path.length - 1].matchName +
                                ' / ' +
                                item.data.state +
                                ' / keyframes: ' +
                                item.data.keyCount
                        );
                        if (item.data.expression) {
                            lines.push(
                                'Expression (enabled ' +
                                    item.data.expressionEnabled +
                                    '):\n' +
                                    item.data.expression
                            );
                        }
                        for (n = 0; n < item.data.keys.length; n++) {
                            key = item.data.keys[n];
                            var keyRow = keyTable.add(
                                'item',
                                (t === 0 ? 'A #' : 'B #') + key.index
                            );
                            keyRow.subItems[0].text = String(key.time);
                            keyRow.subItems[1].text = FX.Presentation.value(
                                key.value
                            );
                            keyRow.subItems[2].text = key.curve;
                            keyRow.fxKeyMetadata = key;
                            lines.push(
                                'Key ' +
                                    key.index +
                                    ' @ ' +
                                    key.time +
                                    ': ' +
                                    key.curve +
                                    '\n' +
                                    FX.JSON.stringify(key)
                            );
                        }
                        if (!item.complete) {
                            lines.push('Partial: ' + item.reasons.join(', '));
                        }
                    }
                }
                if (captures.length === 2) {
                    for (s = 0; s < paths.length; s++) {
                        lines.push(
                            'A/B ' +
                                paths[s][paths[s].length - 1].matchName +
                                ': ' +
                                FX.Animation.compare(
                                    captures[0][s],
                                    captures[1][s]
                                ).status
                        );
                    }
                }
                lines.push(
                    'Easy Ease-like labels recognize a numeric pattern; they do not prove the command used or rendered equivalence.'
                );
                text.text = lines.join('\n\n');
            });
            button(d, 'Close', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function editParameters() {
            cancelEditorContinuation();
            scanner.current();
            var s = selected(), instances = s.instances,
                rows = FX.Presentation.editRows(instances), ids = [], i,
                draftKey = scanner.basic.id + '/' + scanner.analysisRevision,
                choice = FX.Presentation.selectionState(s, true), intent, execution;
            FX.U.assert(choice.action === 'edit', choice.message);
            FX.U.assert(rows.length, 'No public parameters are available for this selection.');
            for (i = 0; i < instances.length; i++) { ids.push(FX.Model.effectKey(instances[i])); }
            ids.sort();
            draftKey += '/' + ids.join('|');
            intent = FX.Editor.open({
                dialog: new Window('dialog', 'Edit Parameters'),
                createDialog: function (title) { return new Window('dialog', title); },
                instances: instances, layerCount: s.layers.length, rows: rows,
                drafts: editorDraft && editorDraft.key === draftKey ? editorDraft.drafts : {},
                lastPath: lastEditorPath && lastEditorPath.matchName === instances[0].matchName ? lastEditorPath.path : null,
                row: row, button: button, guard: guard, showDialog: showDialog,
                onDraftChange: function (drafts) { editorDraft = { key: draftKey, drafts: drafts }; },
                onPathChange: function (path) { lastEditorPath = { matchName: instances[0].matchName, path: FX.U.clone(path) }; }
            });
            if (!intent || disposed) { return; }
            cancelEditorContinuation();
            try {
                execution = confirmAndExecute(instances, 'set', { rows: intent.rows, removeKeyframes: intent.removeKeyframes, requireAll: true });
            } catch (editorApplyError) {
                cancelEditorContinuation();
                throw editorApplyError;
            }
            if (execution === true) {
                editorDraft = null;
            } else {
                cancelEditorContinuation();
                if (execution === false) {
                    status.text = 'Confirmation cancelled. Reopen Edit Parameters to recover all pending changes.';
                }
            }
        }
        function cancelEditorContinuation() {
            editorContinueRequest = null;
            if (editorContinueTask !== null) {
                var task = editorContinueTask;
                editorContinueTask = null;
                try { adapter.cancelTask(task); }
                catch (continuationCancelError) { diagnostics.error('editor-cancel-task', continuationCancelError); }
            }
        }
        function requestEditorContinuation(instances) {
            // Only the initial Edit action requests an editor after reading.
            // Applying a batch leaves reopening to the user's next Edit click.
            cancelEditorContinuation();
            var ids = [], i;
            for (i = 0; i < instances.length; i++) { ids.push(FX.Model.effectKey(instances[i])); }
            ids.sort();
            editorContinueRequest = { project: scanner.basic.project, keys: ids };
        }
        function queueEditorContinuation() {
            if (!editorContinueRequest || editorContinueTask !== null || disposed) { return; }
            var selection = selected(), keys = [], i,
                ready = FX.Presentation.selectionState(selection, true);
            for (i = 0; i < selection.instances.length; i++) { keys.push(FX.Model.effectKey(selection.instances[i])); }
            keys.sort();
            if (ready.action !== 'edit' || FX.JSON.stringify(keys) !== FX.JSON.stringify(editorContinueRequest.keys)) {
                cancelEditorContinuation();
                return;
            }
            try { editorContinueTask = adapter.schedule(editorCallback, sessionEpoch); }
            catch (continueScheduleError) {
                cancelEditorContinuation();
                reportError('editor-schedule', continueScheduleError);
            }
        }
        function selected() {
            var out = { instances: [], layers: [] },
                seen = {},
                i,
                e,
                l;
            for (i = 0; i < view.instances.length; i++) {
                e = view.instances[i];
                if (selectedEffects['$' + FX.Model.effectKey(e)]) {
                    out.instances.push(e);
                    seen['$' + FX.Model.layerKey(e)] = true;
                }
            }
            for (i = 0; i < view.layers.length; i++) {
                l = view.layers[i];
                if (
                    selectedLayers['$' + FX.Model.layerKey(l)] ||
                    seen['$' + FX.Model.layerKey(l)]
                ) {
                    out.layers.push(l);
                }
            }
            return out;
        }
        function nodeData(instances, layers) {
            return { instances: instances || [], layers: layers || [] };
        }
        function addNode(parent, title, data, leaf, id) {
            var n = parent.add(leaf ? 'item' : 'node', title);
            n.fxData = data;
            n.fxTitle = title;
            n.fxLeaf = !!leaf;
            n.fxParentNode = parent === tree ? null : parent;
            n.fxDepth = parent === tree ? 0 : parent.fxDepth + 1;
            n.helpTip =
                data.instances.length === 1
                    ? 'Original name: ' +
                      data.instances[0].effectName +
                      '\nmatchName: ' +
                      data.instances[0].matchName
                    : title;
            n.fxNodeKey = (parent.fxNodeKey || '') + '/' + (id || title);
            renderedNodes.push(n);
            if (selectionAnchor === n.fxNodeKey) {
                tree.anchor = n;
            }
            if (FX.U.own(expansion, '$' + n.fxNodeKey)) {
                n.expanded = expansion['$' + n.fxNodeKey];
            }
            if (activeNodeKey === n.fxNodeKey) {
                tree.selection = n;
                activeTarget = data;
            } else if (
                leaf &&
                !tree.selection &&
                data.instances.length === 1 &&
                FX.Model.effectKey(data.instances[0]) === activeEffectKey
            ) {
                tree.selection = n;
                activeTarget = data;
            }
            return n;
        }
        function refreshMarks(parent) {
            var wasSelecting = selecting,
                focus = tree.selection,
                i,
                label;
            selecting = true;
            try {
                for (i = 0; i < renderedNodes.length; i++) {
                    renderedNodes[i].fxSelected =
                        selectionMark(renderedNodes[i].fxData) === '[x] ';
                    label =
                        selectionMark(renderedNodes[i].fxData) +
                        renderedNodes[i].fxTitle;
                    if (renderedNodes[i].text !== label) {
                        renderedNodes[i].text = label;
                    }
                }
                if (tree.selection !== focus) {
                    tree.selection = focus;
                }
                tree.refresh();
            } catch (markError) {
                lastRender = null;
                presentationFailed = true;
                tree.control.enabled = false;
                updateActions();
                throw markError;
            } finally {
                selecting = wasSelecting;
            }
            if (parent === tree) {
                diagnostics.measure('selectionMarks', 0, renderedNodes.length);
            }
        }
        function toggleNode(flag) {
            var n = tree.selection;
            if (!n || !n.fxData) {
                return;
            }
            var data = n.fxData,
                i;
            for (i = 0; i < data.instances.length; i++) {
                selectedEffects['$' + FX.Model.effectKey(data.instances[i])] =
                    flag;
            }
            for (i = 0; i < data.layers.length; i++) {
                selectedLayers['$' + FX.Model.layerKey(data.layers[i])] = flag;
            }
            refreshMarks(tree);
            updateActions();
        }
        function setAll(flag) {
            activeTarget = null;
            var i, k;
            for (i = 0; i < view.instances.length; i++) {
                k = '$' + FX.Model.effectKey(view.instances[i]);
                if (flag === null) {
                    selectedEffects[k] = !selectedEffects[k];
                } else {
                    selectedEffects[k] = flag;
                }
            }
            for (i = 0; i < view.layers.length; i++) {
                k = '$' + FX.Model.layerKey(view.layers[i]);
                if (flag === null) {
                    selectedLayers[k] = !selectedLayers[k];
                } else {
                    selectedLayers[k] = flag;
                }
            }
            refreshMarks(tree);
            updateActions();
        }
        function render() {
            if (dialogs.length) {
                renderPending = true;
                return false;
            }
            if (
                disposed ||
                scanner.job ||
                renderInProgress ||
                batch.executing
            ) {
                return false;
            }
            var started = FX.U.now();
            renderInProgress = true;
            try {
                if (buildRender() === false) {
                    return false;
                }
                presentationFailed = false;
                tree.control.enabled = true;
                updateActions();
                return true;
            } catch (error) {
                lastRender = null;
                presentationFailed = true;
                try {
                    tree.control.enabled = false;
                    updateActions();
                } catch (ignoredActions) {}
                reportError('render', error);
                return false;
            } finally {
                renderInProgress = false;
                rendering = false;
                FX.U.measure(diagnostics, 'renderTotal', started, 1);
            }
        }
        function buildRender() {
            var inventory = scanner.inventory();
            if (!inventory || inventory.stale) {
                return false;
            }
            var renderStarted = FX.U.now(),
                mode = modes[groupBy.selection.index],
                i,
                j,
                g,
                e,
                key,
                tk,
                parent,
                compKey,
                filtered = FX.Filters.apply(
                    inventory,
                    FX.U.clone(filters),
                    false,
                    true
                );
            view = FX.Filters.search(filtered, displayQuery);
            var showLayers =
                mode === 'layers' ||
                (!view.instances.length && view.layers.length > 0);
            if (showLayers) {
                view = { layers: view.layers, instances: [] };
            }
            var total = showLayers ? view.layers.length : view.instances.length;
            page = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
            var signature = [
                    inventory.id,
                    scanner.analysisRevision,
                    mode,
                    FX.JSON.stringify(paths)
                ],
                si;
            for (si = 0; si < view.instances.length; si++) {
                signature.push(FX.Model.effectKey(view.instances[si]));
            }
            for (si = 0; si < view.layers.length; si++) {
                signature.push(FX.Model.layerKey(view.layers[si]));
            }
            var groupKey = FX.JSON.stringify(signature),
                treeKey = groupKey + '/' + page;
            if (lastRender === treeKey) {
                diagnostics.measure('renderReuse', 0, 1);
                updateActions();
                return;
            }
            var cached = null,
                groupStarted = FX.U.now();
            for (i = 0; i < groupCache.length; i++) {
                if (groupCache[i].key === groupKey) {
                    cached = groupCache[i];
                    break;
                }
            }
            if (cached) {
                groups = cached.groups;
                diagnostics.measure('groupingReuse', 0, 1);
            } else {
                groups = [];
                if (!showLayers && mode !== 'occurrences') {
                    groups = FX.Grouping.build(
                        view.instances,
                        mode,
                        paths,
                        true
                    );
                }
                groupCache.push({ key: groupKey, groups: groups });
                if (groupCache.length > 3) {
                    groupCache.shift();
                }
                diagnostics.measure(
                    'grouping',
                    FX.U.now() - groupStarted,
                    view.instances.length
                );
            }
            expansion = {};
            for (i = 0; i < renderedNodes.length; i++) {
                expansion['$' + renderedNodes[i].fxNodeKey] =
                    !!renderedNodes[i].expanded;
            }
            var treeStarted = FX.U.now();
            rendering = true;
            try {
                tree.removeAll();
                renderedNodes = [];
                pageEffects = {};
                var effects = {},
                    types = {},
                    rootMembers = {},
                    typeMembers = {},
                    byComp = {},
                    offset = 0,
                    first = page * pageSize,
                    last = first + pageSize;
                function effectPartition(group) {
                    return (
                        '$' +
                        group.matchName +
                        (mode === 'composition'
                            ? '/' + group.instances[0].compId
                            : '')
                    );
                }
                function push(map, k, value) {
                    if (!map[k]) {
                        map[k] = [];
                    }
                    map[k].push(value);
                }
                if (mode === 'occurrences' && !showLayers) {
                    for (
                        i = first;
                        i < view.instances.length && i < last;
                        i++
                    ) {
                        e = view.instances[i];
                        addNode(
                            tree,
                            e.compName +
                                ' / ' +
                                e.layerName +
                                ' / ' +
                                e.effectIndex +
                                '. ' +
                                FX.Presentation.effectName(e) +
                                (e.enabled === false ? ' [Disabled]' : ''),
                            nodeData([e]),
                            true,
                            FX.Model.effectKey(e)
                        );
                        pageEffects['$' + FX.Model.effectKey(e)] = true;
                    }
                }
                for (i = 0; i < groups.length; i++) {
                    g = groups[i];
                    key = effectPartition(g);
                    tk = key + '/' + g.layerType;
                    for (j = 0; j < g.instances.length; j++) {
                        push(rootMembers, key, g.instances[j]);
                        push(typeMembers, tk, g.instances[j]);
                    }
                }
                for (i = 0; i < groups.length; i++) {
                    g = groups[i];
                    var groupFirst = offset;
                    offset += g.instances.length;
                    if (offset <= first || groupFirst >= last) {
                        continue;
                    }
                    key = effectPartition(g);
                    tk = key + '/' + g.layerType;
                    parent = effects[key];
                    if (!parent) {
                        var title = FX.Presentation.effectName(g);
                        if (mode === 'composition') {
                            title = g.compName + ' / ' + title;
                        }
                        parent = addNode(
                            tree,
                            title +
                                ' - ' +
                                rootMembers[key].length +
                                ' effects',
                            nodeData(rootMembers[key]),
                            false,
                            key
                        );
                        effects[key] = parent;
                        if (!FX.U.own(expansion, '$' + parent.fxNodeKey)) {
                            parent.expanded = true;
                        }
                    }
                    if (
                        mode === 'type' ||
                        mode === 'type-config' ||
                        mode === 'selected'
                    ) {
                        if (!types[tk]) {
                            types[tk] = addNode(
                                parent,
                                g.layerType +
                                    ' Layers - ' +
                                    typeMembers[tk].length +
                                    ' effects',
                                nodeData(typeMembers[tk]),
                                false,
                                tk
                            );
                            if (
                                !FX.U.own(expansion, '$' + types[tk].fxNodeKey)
                            ) {
                                types[tk].expanded = true;
                            }
                        }
                        parent = types[tk];
                    }
                    if (mode !== 'effect' && mode !== 'type') {
                        parent = addNode(
                            parent,
                            FX.Presentation.groupTitle(g),
                            nodeData(g.instances),
                            false,
                            g.id
                        );
                        parent.fxGroup = g;
                    }
                    var compMembers = {},
                        compNodes = {};
                    for (j = 0; j < g.instances.length; j++) {
                        push(
                            compMembers,
                            '$' + g.instances[j].compId,
                            g.instances[j]
                        );
                    }
                    for (
                        j = Math.max(0, first - groupFirst);
                        j < g.instances.length && groupFirst + j < last;
                        j++
                    ) {
                        e = g.instances[j];
                        compKey = '$' + e.compId;
                        if (!compNodes[compKey]) {
                            compNodes[compKey] = addNode(
                                parent,
                                e.compName,
                                nodeData(compMembers[compKey]),
                                false,
                                compKey
                            );
                        }
                        addNode(
                            compNodes[compKey],
                            e.layerName +
                                ' / ' +
                                FX.Presentation.effectName(e) +
                                (e.enabled === false ? ' / Disabled' : ''),
                            nodeData([e]),
                            true,
                            FX.Model.effectKey(e)
                        );
                        pageEffects['$' + FX.Model.effectKey(e)] = true;
                    }
                }
                if (showLayers) {
                    var layerRoot = addNode(
                            tree,
                            'Layers - ' + view.layers.length,
                            nodeData([], view.layers),
                            false,
                            'layers'
                        ),
                        layerMembers = {};
                    for (i = 0; i < view.layers.length; i++) {
                        push(
                            layerMembers,
                            '$' + view.layers[i].compId,
                            view.layers[i]
                        );
                    }
                    for (i = first; i < view.layers.length && i < last; i++) {
                        e = view.layers[i];
                        compKey = '$' + e.compId;
                        if (!byComp[compKey]) {
                            byComp[compKey] = addNode(
                                layerRoot,
                                e.compName,
                                nodeData([], layerMembers[compKey]),
                                false,
                                compKey
                            );
                        }
                        addNode(
                            byComp[compKey],
                            e.layerName + ' / ' + e.layerType,
                            nodeData([], [e]),
                            true,
                            FX.Model.layerKey(e)
                        );
                    }
                }
                pager.visible = total > pageSize;
                pager.maximumSize.height = pager.visible ? 10000 : 0;
                previousPage.enabled = page > 0;
                nextPage.enabled = last < total;
                pageText.text =
                    (total ? first + 1 : 0) +
                    '-' +
                    Math.min(last, total) +
                    ' / ' +
                    total;
                pageText.helpTip =
                    'Pages limit displayed rows. Group selection includes all matching occurrences; the counter and confirmation show targets.';
            } finally {
                rendering = false;
                diagnostics.measure(
                    'treeBuild',
                    FX.U.now() - treeStarted,
                    renderedNodes.length
                );
            }
            refreshMarks(tree);
            updateActions();
            layoutViewport();
            lastRender = treeKey;
            diagnostics.measure(
                'render',
                FX.U.now() - renderStarted,
                renderedNodes.length
            );
        }
        function actionIds() {
            var s = selected(),
                state = FX.Presentation.selectionState(s, true),
                ids = [];
            if (s.instances.length) {
                if (state.same && state.analyzed) {
                    ids.push('copy');
                }
                ids.push('enable');
                ids.push('disable');
                ids.push('remove');
            }
            if (s.layers.length) {
                ids.push('apply');
            }
            return ids;
        }
        function updateActions() {
            var layoutChanged = resultsButton.visible !== !!lastReport;
            searchButton.enabled = !busy;
            mainView.enabled = !busy;
            resultsButton.enabled = !!lastReport && !busy;
            selectResultsButton.enabled =
                !!scanner.basic &&
                !scanner.basic.stale &&
                !busy &&
                (view.instances.length > 0 || view.layers.length > 0);
            resultsButton.visible = !!lastReport;
            parameterGroup.visible = false;
            parameterGroup.enabled = !busy && parameterGroup.visible;
            var s = selected(),
                fresh = !!scanner.basic && !scanner.basic.stale,
                choice = FX.Presentation.selectionState(s, fresh),
                hidden = 0,
                inventory = scanner.inventory(),
                i;
            if (inventory) {
                for (i = 0; i < inventory.instances.length; i++) {
                    if (
                        selectedEffects[
                            '$' + FX.Model.effectKey(inventory.instances[i])
                        ]
                    ) {
                        hidden++;
                    }
                }
            }
            hidden -= s.instances.length;
            var offPage = 0;
            if (view.instances.length > pageSize) {
                for (i = 0; i < s.instances.length; i++) {
                    if (
                        !pageEffects['$' + FX.Model.effectKey(s.instances[i])]
                    ) {
                        offPage++;
                    }
                }
            }
            summary.text =
                s.instances.length +
                ' effects / ' +
                s.layers.length +
                ' layers selected';
            if (s.instances.length && choice.same) {
                summary.text =
                    FX.Presentation.effectName(s.instances[0]) +
                    ' - ' +
                    summary.text;
            }
            if (hidden > 0) {
                summary.text += ' (' + hidden + ' hidden, excluded)';
            }
            if (offPage) {
                summary.text += ' (' + offPage + ' on other pages, included)';
            }
            primaryButton.text = 'Select an effect';
            if (choice.action === 'scan') {
                primaryButton.text = fresh ? 'Scan' : 'Refresh';
            }
            if (choice.action === 'analyze') {
                primaryButton.text = choice.same ? 'Edit Parameters...' : 'Read Parameters';
            }
            if (choice.action === 'edit') {
                primaryButton.text = 'Edit Parameters...';
            }
            primaryButton.enabled = !busy && choice.action !== 'none';
            primaryButton.visible = !!scanner.basic;
            primaryButton.helpTip = choice.message;
            scanButton.text =
                scanner.basic && scanner.basic.stale ? 'Refresh' : 'Scan';
            locateButton.enabled = fresh && !busy && s.layers.length > 0;
            actionsButton.enabled = fresh && !busy && actionIds().length > 0;
            enableButton.enabled = fresh && !busy && s.instances.length > 0;
            disableButton.enabled = enableButton.enabled;
            addButton.enabled = fresh && !busy && s.layers.length > 0;
            presetsButton.enabled = !busy;
            if (!busy) {
                status.text = choice.message;
            }
            if (fresh && !view.instances.length && !view.layers.length) {
                status.text = 'No results. Change search or filters.';
            }
            if (presentationFailed) {
                primaryButton.text = 'Retry display';
                primaryButton.enabled = !busy;
                locateButton.enabled = false;
                actionsButton.enabled = false;
                enableButton.enabled =
                    disableButton.enabled =
                    addButton.enabled =
                        false;
                status.text =
                    'Display failed. Retry display, press Enter or run Scan. Scanner data retained.';
            }
            if (searchPending) {
                primaryButton.enabled = false;
                locateButton.enabled = false;
                actionsButton.enabled = false;
                enableButton.enabled =
                    disableButton.enabled =
                    addButton.enabled =
                        false;
                status.text =
                    'Search pending. Click Search, press Enter or select a matching result.';
            }
            if (layoutChanged) {
                layoutViewport();
            }
        }
        function searchProject() {
            if (disposed || busy || renderInProgress || dialogs.length) {
                return false;
            }
            if (!scanner.basic || scanner.basic.stale) {
                displayQuery = search.text;
                searchPending = false;
                runScan(!!scanner.basic);
                return (
                    !!scanner.job || (!!scanner.basic && !scanner.basic.stale)
                );
            }
            return applySearch();
        }
        function applySearch() {
            if (renderInProgress || disposed || dialogs.length || scanner.job) {
                return false;
            }
            if (!scanner.basic || scanner.basic.stale) {
                status.text =
                    'Click Search to inventory the selected scope first.';
                return false;
            }
            displayQuery = search.text;
            searchPending = false;
            page = 0;
            if (render()) {
                status.text =
                    view.instances.length +
                    ' effects / ' +
                    view.layers.length +
                    ' layers match. Select a result to continue.';
                if (!view.instances.length && !view.layers.length) {
                    status.text = 'No results. Change search or filters.';
                }
                return true;
            }
            return false;
        }
        function context() {
            updateActions();
        }
        function actionsDialog() {
            FX.U.assert(
                !busy && scanner.basic && !scanner.basic.stale,
                'Refresh before continuing.'
            );
            var ids = actionIds(),
                selection = selected(),
                choice = FX.Presentation.selectionState(selection, true),
                action = null;
            if (!ids.length) {
                status.text = 'Select an effect or group to continue.';
                return;
            }
            var d = new Window('dialog', 'More Actions');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var actionHost = d, actionLine = null, actionColumn = 0;
            function actionSection(title) {
                actionHost = d.add('panel', undefined, title);
                actionHost.orientation = 'column';
                actionHost.alignChildren = 'fill';
                actionLine = null;
                actionColumn = 0;
            }
            function actionButton(title, id) {
                if (!actionLine || actionColumn === 2) {
                    actionLine = row(actionHost);
                    actionColumn = 0;
                }
                actionColumn++;
                button(actionLine, title, function () {
                    action = id;
                    d.close(1);
                });
            }
            var i,
                names = {
                    copy: 'Copy Settings From...',
                    enable: 'Enable',
                    disable: 'Disable',
                    remove: 'Remove',
                    apply: 'Apply Effect...'
                };
            actionSection('Parameters');
            if (selection.instances.length && !choice.analyzed) {
                actionButton('Read Parameters', 'read-parameters');
            }
            for (i = 0; i < ids.length; i++) {
                if (ids[i] === 'copy') { actionButton(names[ids[i]], ids[i]); }
            }
            if (selection.instances.length && choice.same && choice.analyzed) {
                actionButton('Compare...', 'compare');
                if (selection.instances.length <= 2) {
                    actionButton('Inspect Animation...', 'animation');
                }
            }
            if (selection.instances.length) {
                if (choice.action === 'edit') {
                    actionButton('Copy Parameters...', 'capture-parameters');
                    actionButton('Save Effect Preset...', 'save-preset');
                    if (
                        parameterClipboard &&
                        parameterClipboard.matchName ===
                            selection.instances[0].matchName
                    ) {
                        actionButton('Paste Parameters...', 'paste-parameters');
                    }
                }
            }
            actionSection('Effects');
            for (i = 0; i < ids.length; i++) {
                if (ids[i] !== 'copy') { actionButton(names[ids[i]], ids[i]); }
            }
            actionSection('Selection and display');
            actionButton('Add to Selection', 'add');
            actionButton('Clear Selection', 'clear');
            actionButton('Selection...', 'selection');
            actionButton('Grouping...', 'groups');
            actionSection('Support');
            if (selection.instances.length) { actionButton('Details...', 'details'); }
            actionButton('Diagnostics...', 'diagnostics');
            if (lastReport && lastReport.issues.length) {
                actionButton('Issues...', 'issues');
            }
            button(d, 'Cancel', function () {
                d.close(0);
            });
            if (showDialog(d) !== 1) {
                return;
            }
            // Close the action chooser before opening a work dialog.
            if (action === 'read-parameters') {
                analyzeSelection();
            } else if (action === 'add') {
                adding = true;
                status.text = 'Click another group to add it to the selection.';
            } else if (action === 'clear') {
                clearSelection();
            } else if (action === 'selection') {
                selectionDialog();
            } else if (action === 'groups') {
                advancedGroups();
            } else if (action === 'capture-parameters') {
                captureParameters();
            } else if (action === 'save-preset') {
                saveEffectPreset();
            } else if (action === 'paste-parameters') {
                pasteParameters();
            } else if (action === 'compare') {
                compareDialog();
            } else if (action === 'animation') {
                animationDialog();
            } else if (action === 'details') {
                detailsDialog();
            } else if (action === 'diagnostics') {
                diagnosticDialog();
            } else if (action === 'issues') {
                issuesDialog();
            } else if (action === 'copy') {
                sourceRows = null;
                copyReference();
                if (sourceRows && sourceRows.length) {
                    confirmAndExecute(selection.instances, 'copy', {
                        rows: sourceRows
                    });
                }
            } else if (action === 'apply') {
                effectMatchName = '';
                chooseEffect();
                if (effectMatchName) {
                    confirmAndExecute(selection.layers, 'apply', {
                        matchName: effectMatchName,
                        displayName: effectDisplayName
                    });
                }
            } else if (action) {
                confirmAndExecute(selection.instances, action, {});
            }
        }
        function invalidateScope() {
            cancelEditorContinuation();
            scanner.invalidate();
            refreshTargets = null;
            pendingRestore = null;
            pendingParameterRefresh = null;
            activeEffectKey = null;
            activeNodeKey = null;
            activeTarget = null;
            groupCache = [];
            renderedNodes = [];
            lastRender = null;
            pager.visible = false;
            pager.maximumSize.height = 0;
            busy = false;
            scanButton.enabled = true;
            cancelButton.enabled = false;
            selectedEffects = {};
            selectedLayers = {};
            view = { layers: [], instances: [] };
            tree.removeAll();
            updateActions();
            status.text = 'Results Outdated - scope changed. Run Scan.';
            state.preferences.scope = scopes[scope.selection.index];
            save();
        }
        scope.onChange = guard(function () {
            if (initializing) {
                return;
            }
            choose.enabled = scope.selection.index === 1;
            invalidateScope();
        }, 'scope-change');
        search.onChanging = search.onChange = guard(function () {
            searchPending = search.text !== displayQuery;
            diagnostics.measure('searchDeferred', 0, 1);
            updateActions();
        }, 'search.onChanging');
        search.addEventListener(
            'keydown',
            guard(function (event) {
                if (event.keyName === 'Enter' || event.keyName === 'Return') {
                    searchProject();
                    if (event.preventDefault) {
                        event.preventDefault();
                    }
                }
            }, 'search.keydown')
        );
        function setGroupSelection(index) {
            var previous = viewSyncing;
            viewSyncing = true;
            try {
                if (!groupBy.selection || groupBy.selection.index !== index) {
                    groupBy.selection = index;
                }
            } finally {
                viewSyncing = previous;
            }
        }
        function syncMainView() {
            var index = 1,
                previous = viewSyncing;
            if (modes[groupBy.selection.index] === 'layers') {
                index = 2;
            }
            if (modes[groupBy.selection.index] === 'occurrences') {
                index = 0;
            }
            viewSyncing = true;
            try {
                if (!mainView.selection || mainView.selection.index !== index) {
                    mainView.selection = index;
                }
            } finally {
                viewSyncing = previous;
            }
        }
        groupBy.onChange = guard(function () {
            if (
                initializing ||
                viewSyncing ||
                viewChanging ||
                busy ||
                dialogs.length ||
                !groupBy.selection
            ) {
                return;
            }
            viewChanging = true;
            try {
                if (
                    modes[groupBy.selection.index] === 'selected' &&
                    !paths.length
                ) {
                    setGroupSelection(
                        lastValidGroup === 4 ? 7 : lastValidGroup
                    );
                    status.text =
                        'Choose parameters explicitly in More > Grouping...';
                }
                lastValidGroup = groupBy.selection.index;
                syncMainView();
                if (
                    modes[groupBy.selection.index] !== 'layers' &&
                    modes[groupBy.selection.index] !== 'occurrences'
                ) {
                    advancedChoice = groupBy.selection.index;
                    state.preferences.groupBy = modes[groupBy.selection.index];
                    save();
                }
                render();
            } finally {
                viewChanging = false;
            }
        });
        function advancedGroups() {
            if (
                initializing ||
                advancedDialogOpen ||
                busy ||
                dialogs.length ||
                disposed
            ) {
                return false;
            }
            advancedDialogOpen = true;
            try {
                var d = new Window('dialog', 'Grouping');
                d.orientation = 'column';
                d.alignChildren = 'fill';
                d.add(
                    'statictext',
                    undefined,
                    'Optional comparison views. Effects and Layers do not require grouping.'
                );
                var choice = dropdown(d, [
                    'Configuration / layer type',
                    'Effect',
                    'Effect / layer type',
                    'Full configuration',
                    'Selected parameters',
                    'Composition / configuration'
                ]);
                choice.selection = advancedChoice;
                var requested = advancedChoice;
                button(d, 'Use view', function () {
                    requested = choice.selection.index;
                    d.close(1);
                });
                button(d, 'Cancel', function () {
                    d.close(0);
                });
                if (showDialog(d) !== 1) {
                    return false;
                }
                if (requested === 4) {
                    if (!chooseGrouping()) {
                        return false;
                    }
                }
                advancedChoice = requested;
                setGroupSelection(requested);
                groupBy.onChange();
                return true;
            } finally {
                advancedDialogOpen = false;
            }
        }
        mainView.onChange = guard(function () {
            if (
                initializing ||
                viewSyncing ||
                viewChanging ||
                busy ||
                dialogs.length ||
                !mainView.selection
            ) {
                return;
            }
            var index = advancedChoice;
            if (mainView.selection.index !== 1) {
                index = mainView.selection.index === 2 ? 6 : 7;
            }
            setGroupSelection(index);
            groupBy.onChange();
        }, 'view');
        function beginWork() {
            busy = true;
            try {
                scanButton.enabled = false;
                cancelButton.enabled = true;
                updateActions();
                tick();
            } catch (error) {
                sessionEpoch++;
                scanner.cancel();
                busy = false;
                try {
                    scanButton.enabled = true;
                    cancelButton.enabled = false;
                    updateActions();
                } catch (ignoredControls) {}
                throw error;
            }
        }
        function runScan(restore, readParameters) {
            if (
                disposed ||
                ticking ||
                scanner.ticking ||
                renderInProgress ||
                dialogs.length ||
                batch.executing
            ) {
                return;
            }
            // Do not clear the tree, selection or recovery intent until scope preparation succeeds.
            scanner.start(scopes[scope.selection.index], manualIds);
            if (!readParameters) { cancelEditorContinuation(); }
            sessionEpoch++;
            pendingParameterRefresh = null;
            pendingRestore = restore ? refreshTargets : null;
            if (pendingRestore) {
                pendingRestore.readParameters = readParameters === true;
            }
            selectedEffects = {};
            selectedLayers = {};
            activeTarget = null;
            activeNodeKey = null;
            activeEffectKey = null;
            groupCache = [];
            lastRender = null;
            if (!readParameters) {
                page = 0;
            }
            editorDraft = null;
            beginWork();
        }
        function rememberRefreshTargets(targets, operation) {
            var selection = { instances: [], layers: [] },
                base = scanner.basic,
                layers = {},
                counts = {},
                selectedCounts = {},
                i,
                j,
                l,
                stack,
                e,
                k;
            refreshTargets = { project: base.project, layers: [], effects: [],
                activeEffectKey: activeEffectKey, page: page, readParameters: false };
            for (i = 0; i < base.layers.length; i++) {
                layers['$' + FX.Model.layerKey(base.layers[i])] =
                    base.layers[i];
            }
            var selectedLayerKeys = {};
            for (i = 0; i < targets.length; i++) {
                k = '$' + FX.Model.layerKey(targets[i]);
                if (operation !== 'apply') {
                    selection.instances.push(targets[i]);
                    var family = k + '/' + FX.JSON.stringify([targets[i].matchName, targets[i].effectName]);
                    selectedCounts[family] = (selectedCounts[family] || 0) + 1;
                }
                if (layers[k] && !selectedLayerKeys[k]) {
                    selection.layers.push(layers[k]);
                    selectedLayerKeys[k] = true;
                }
            }
            for (i = 0; i < selection.layers.length; i++) {
                l = layers['$' + FX.Model.layerKey(selection.layers[i])];
                if (l && l.layerId !== null && l.layerId !== undefined) {
                    refreshTargets.layers.push({
                        key: FX.Model.layerKey(l),
                        name: l.layerName,
                        signature: l.stackSignature
                    });
                }
            }
            for (i = 0; i < selection.instances.length; i++) {
                e = selection.instances[i];
                l = layers['$' + FX.Model.layerKey(e)];
                if (!l || l.layerId === null || l.layerId === undefined) {
                    continue;
                }
                k = '$' + FX.Model.layerKey(l);
                if (!counts[k]) {
                    counts[k] = {};
                    stack = FX.JSON.parse(l.stackSignature);
                    for (j = 0; j < stack.length; j++) {
                        var identity =
                            '$' +
                            FX.JSON.stringify([
                                stack[j].matchName,
                                stack[j].name
                            ]);
                        counts[k][identity] = (counts[k][identity] || 0) + 1;
                    }
                }
                identity = '$' + FX.JSON.stringify([e.matchName, e.effectName]);
                refreshTargets.effects.push({
                    key: FX.Model.effectKey(e),
                    layerKey: FX.Model.layerKey(e),
                    name: e.effectName,
                    matchName: e.matchName,
                    signature: l.stackSignature,
                    unique: counts[k][identity] === 1,
                    completeFamily: selectedCounts[k + '/' + FX.JSON.stringify([e.matchName, e.effectName])] === counts[k][identity]
                });
            }
        }
        function restoreRefreshTargets(result) {
            var saved = pendingRestore;
            if (!saved || saved.project !== result.project) {
                return null;
            }
            var layers = {},
                effects = {},
                i,
                l,
                e,
                restored = 0,
                targets = [];
            for (i = 0; i < result.layers.length; i++) {
                layers['$' + FX.Model.layerKey(result.layers[i])] =
                    result.layers[i];
            }
            for (i = 0; i < result.instances.length; i++) {
                effects['$' + FX.Model.effectKey(result.instances[i])] =
                    result.instances[i];
            }
            for (i = 0; i < saved.layers.length; i++) {
                l = layers['$' + saved.layers[i].key];
                if (l && l.layerName === saved.layers[i].name) {
                    selectedLayers['$' + saved.layers[i].key] = true;
                }
            }
            for (i = 0; i < saved.effects.length; i++) {
                var old = saved.effects[i];
                e = effects['$' + old.key];
                l = layers['$' + old.layerKey];
                if (
                    e &&
                    l &&
                    (old.unique || old.completeFamily) &&
                    l.stackSignature === old.signature &&
                    e.effectName === old.name &&
                    e.matchName === old.matchName
                ) {
                    selectedEffects['$' + old.key] = true;
                    targets.push(e);
                    restored++;
                }
            }
            pendingRestore = null;
            refreshTargets = null;
            if (saved.readParameters) {
                page = saved.page;
                if (saved.activeEffectKey && selectedEffects['$' + saved.activeEffectKey]) {
                    activeEffectKey = saved.activeEffectKey;
                }
            }
            return {
                restored: restored,
                skipped: saved.effects.length - restored,
                targets: targets,
                readParameters: saved.readParameters
            };
        }
        function currentFilters() {
            return FX.U.clone(filters);
        }
        var callback = 'FXExchangerTick_' + FX.U.id('ui').replace(/-/g, '_'),
            editorCallback = callback + '_Editor';
        $.global[editorCallback] = guard(function (epoch) {
            editorContinueTask = null;
            var request = editorContinueRequest;
            editorContinueRequest = null;
            if (!request || disposed || epoch !== sessionEpoch || busy || scanner.job || dialogs.length ||
                request.project !== adapter.project()) { return; }
            var targets = selected().instances, keys = [], i;
            for (i = 0; i < targets.length; i++) { keys.push(FX.Model.effectKey(targets[i])); }
            keys.sort();
            if (FX.JSON.stringify(keys) !== FX.JSON.stringify(request.keys)) { return; }
            editParameters();
        }, 'editor-continuation');
        function tick() {
            diagnostics.measure('callbacks', 0, 1);
            if (disposed || ticking || !scanner.job) {
                return;
            }
            ticking = true;
            try {
                // Cancel even an early/duplicate invocation; failure cannot leave a live job.
                if (scanner.task !== null) {
                    var pending = scanner.task;
                    scanner.task = null;
                    adapter.cancelTask(pending);
                }
                if (
                    scanner.tick() &&
                    !disposed &&
                    scanner.job &&
                    scanner.task === null
                ) {
                    scanner.task = adapter.schedule(callback, sessionEpoch);
                }
            } catch (e) {
                pendingParameterRefresh = null;
                cancelEditorContinuation();
                pendingRestore = null;
                scanner.invalidate();
                busy = false;
                scanButton.enabled = true;
                cancelButton.enabled = false;
                status.text =
                    'Error - operation stopped. See Diagnostics; run Scan again.';
                reportError('scan', e);
            } finally {
                ticking = false;
            }
        }
        $.global[callback] = function (epoch) {
            if (!disposed && epoch === sessionEpoch) {
                tick();
            }
        };
        scanner.onObserverError = function (name, error) {
            reportError('presentation/' + name, error);
        };
        scanner.onProgress = function (l, e, c, total, phase) {
            status.text =
                (phase === 'basic'
                    ? 'Scanning '
                    : 'Analyzing Configurations ') +
                Math.min(c + 1, total) +
                ' / ' +
                total +
                (phase === 'basic' ? ' compositions; ' : ' candidates; ') +
                l +
                ' layers / ' +
                e +
                ' effects';
        };
        scanner.onDone = function (result) {
            if (disposed) {
                return;
            }
            busy = false;
            scanButton.enabled = true;
            cancelButton.enabled = false;
            var recovered =
                result.analysisState === 'basic'
                    ? restoreRefreshTargets(result)
                    : null;
            if (recovered && recovered.readParameters && recovered.targets.length) {
                try {
                    // This continues the explicit edit request, over its safely
                    // recovered targets only. The next scheduler tick performs
                    // the read; no nested ticks, dialogs or repeated writes.
                    scanner.analyze({}, recovered.targets);
                    pendingParameterRefresh = {
                        project: result.project,
                        expected: recovered.targets.length,
                        skipped: recovered.skipped
                    };
                    busy = true;
                    scanButton.enabled = false;
                    cancelButton.enabled = true;
                    status.text = 'Changes applied. Updating parameters for ' + recovered.targets.length + ' selected effects...';
                    updateActions();
                    return;
                } catch (readStartError) {
                    pendingParameterRefresh = null;
                    cancelEditorContinuation();
                    scanner.cancel();
                    busy = false;
                    scanButton.enabled = true;
                    cancelButton.enabled = false;
                    render();
                    reportError('post-edit-read', readStartError);
                    status.text = 'Changes applied. Parameters could not be updated; review Results and refresh/read parameters to continue.';
                    return;
                }
            }
            var parameterRefresh = pendingParameterRefresh;
            pendingParameterRefresh = null;
            var displayed = render();
            if (!displayed) { cancelEditorContinuation(); }
            if (parameterRefresh && displayed && parameterRefresh.project === result.project) {
                var visibleSelection = selected(),
                    ready = FX.Presentation.selectionState(visibleSelection, true);
                status.text = 'Changes applied. Parameters updated for ' + result.instances.length +
                    '/' + parameterRefresh.expected + ' effects. ';
                if (ready.action === 'edit') {
                    status.text += 'Ready to continue editing the selection.';
                } else {
                    status.text += ready.message;
                }
                if (visibleSelection.instances.length < result.instances.length) {
                    status.text += ' Some updated effects no longer match the current filters.';
                }
                if (parameterRefresh.skipped) {
                    status.text += ' ' + parameterRefresh.skipped + ' changed/ambiguous targets were not restored.';
                }
                queueEditorContinuation();
                return;
            }
            if (recovered && displayed) {
                status.text +=
                    ' Restored ' +
                    recovered.restored +
                    ' effects; ' +
                    recovered.skipped +
                    ' ambiguous/changed targets not restored.';
            }
            if (displayed && result.analysisState === 'analyzed') { queueEditorContinuation(); }
        };
        batch.onProgress = function (index, total) {
            if (!disposed) {
                status.text =
                    'Applying target ' +
                    (index + 1) +
                    ' / ' +
                    total +
                    '. Await host return; Cancel cannot interrupt a synchronous API.';
            }
        };
        function confirmAndExecute(targets, id, options) {
            var plan = batch.preview(targets, id, options),
                title = id,
                description = '',
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
                    description +=
                        change.name +
                        ': ' +
                        from +
                        ' -> ' +
                        (change.keepCurrent ? 'Keep each current value; clear keyframes' : FX.Parameters.display(change)) +
                        '\n';
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
            var d = new Window('dialog', 'Confirm changes');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add('statictext', undefined, title);
            var text = d.add('edittext', undefined, description, {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [
                400,
                Math.min(
                    260,
                    70 + (options.rows ? options.rows.length * 32 : 0)
                )
            ];
            var agreement = null,
                animationAgreement = null;
            if (partial) {
                agreement = d.add(
                    'checkbox',
                    undefined,
                    'I agree to apply only compatible occurrences.'
                );
                agreement.value = false;
            }
            if (plan.keyframeCount) {
                animationAgreement = d.add('checkbox', undefined,
                    'I agree to remove ' + plan.keyframeCount + ' keyframes from the specified parameters.');
                animationAgreement.value = false;
            }
            var controls = row(d);
            var apply = button(controls, 'Apply', function () {
                if ((partial && !agreement.value) || (animationAgreement && !animationAgreement.value)) {
                    return;
                }
                d.close(1);
            });
            function updateAgreement() {
                apply.enabled = (!partial || agreement.value) &&
                    (!animationAgreement || animationAgreement.value);
            }
            updateAgreement();
            if (agreement) {
                agreement.onClick = updateAgreement;
            }
            if (animationAgreement) {
                animationAgreement.onClick = updateAgreement;
            }
            button(controls, 'Cancel', function () {
                d.close(0);
            });
            d.center();
            if (showDialog(d) !== 1 || disposed) {
                return false;
            }
            FX.U.assert(
                !dialogs.length,
                'Close dialogs before executing changes'
            );
            rememberRefreshTargets(targets, id);
            busy = true;
            lastReport = null;
            batch.lastReport = null;
            var batchFailure = null;
            try {
                scanButton.enabled = false;
                cancelButton.enabled = false;
                status.text =
                    'Validating all targets before writing. Synchronous host calls may block this panel.';
                updateActions();
                lastReport = batch.execute(plan);
            } catch (batchError) {
                lastReport = batch.lastReport;
                batchFailure = batchError;
            } finally {
                busy = false;
                scanButton.enabled = true;
                cancelButton.enabled = false;
                context();
            }
            if (batchFailure) {
                reportError('batch', batchFailure);
            }
            if (!lastReport) {
                return null;
            }
            reportText.visible = true;
            reportText.maximumSize.height = 10000;
            reportText.text = FX.Presentation.reportSummary(lastReport);
            context();
            status.text =
                'Review Results; Refresh before continuing. Do not retry uncertain writes automatically.';
            layoutViewport();
            if (
                settings.autoRefresh !== false &&
                lastReport.completed &&
                lastReport.changed > 0 &&
                !lastReport.failed &&
                !lastReport.unknown &&
                !lastReport.verificationFailed
            ) {
                runScan(true, id === 'set' || id === 'copy');
            }
            return true;
        }
        function presets() {
            if (!presetLibrary) {
                presetLibrary = new FX.Presets.Library(
                    settings.presetStore ||
                        (settings.noStorage ? null : FX.Presets.store())
                );
            }
            return presetLibrary;
        }
        function inputText(title, description, value) {
            var d = new Window('dialog', title),
                result = null;
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add('statictext', undefined, description, { multiline: true });
            var field = d.add('edittext', undefined, value || '');
            field.characters = 40;
            button(d, 'Save', function () {
                result = field.text;
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            return showDialog(d) === 1 ? result : null;
        }
        function parameterData() {
            var targets = selected().instances,
                i,
                chosen = 0,
                sourcesWithValues = [];
            FX.U.assert(targets.length, 'Select analyzed occurrences first.');
            for (i = 0; i < targets.length; i++) {
                FX.U.assert(
                    targets[i].configuration &&
                        targets[i].matchName === targets[0].matchName,
                    'Use Read Parameters and select one effect type first.'
                );
                if (targets[i].configuration.properties.length) {
                    sourcesWithValues.push(targets[i]);
                }
            }
            targets = sourcesWithValues;
            FX.U.assert(
                targets.length,
                'No compatible static parameters are available. Animation inspection is read only.'
            );
            var d = new Window('dialog', 'Copy Parameters');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                'Choose the source occurrence. Only the static parameters you choose will be copied.'
            );
            var sources = dropdown(d, []);
            for (i = 0; i < targets.length; i++) {
                sources.add(
                    'item',
                    targets[i].compName +
                        ' / ' +
                        targets[i].layerName +
                        ' / #' +
                        targets[i].effectIndex
                );
            }
            sources.selection = 0;
            button(d, 'Choose source', function () {
                chosen = sources.selection.index;
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            if (showDialog(d) !== 1) {
                return null;
            }
            var source = targets[chosen],
                rows = pickRows(
                    source.configuration,
                    'Choose parameters to copy'
                );
            if (!rows || !rows.length) {
                return null;
            }
            return {
                matchName: source.matchName,
                sourceName: FX.Presentation.effectName(source),
                rows: rows,
                omitted:
                    source.configuration.unsupported.length +
                    source.configuration.properties.length -
                    rows.length
            };
        }
        function captureParameters() {
            var data = parameterData();
            if (data) {
                parameterClipboard = FX.U.clone(data);
                status.text =
                    data.rows.length +
                    ' parameters copied. Select analyzed destinations of the same effect, then More > Paste Parameters.';
            }
        }
        function pasteParameters(preset) {
            var data = preset || parameterClipboard,
                targets = selected().instances,
                i,
                publicRows;
            FX.U.assert(
                data && targets.length,
                'Copy parameters or choose a preset, then select destinations.'
            );
            for (i = 0; i < targets.length; i++) {
                FX.U.assert(
                    targets[i].matchName === data.matchName &&
                        targets[i].configuration,
                    'Select analyzed occurrences of the same effect. Other effect types cannot receive these parameters.'
                );
            }
            publicRows = FX.Parameters.rows(data.matchName, FX.U.clone(data.rows));
            FX.U.assert(publicRows.length, 'No public parameters remain in this clipboard/preset.');
            return confirmAndExecute(targets, 'copy', {
                rows: publicRows
            });
        }
        function saveEffectPreset() {
            var data = parameterData();
            if (!data) {
                return;
            }
            var name = inputText(
                'Save effect preset',
                'Static parameters of one effect only. Omitted parameters: ' +
                    data.omitted +
                    '. Animation and expressions are not saved.',
                data.sourceName
            );
            if (name !== null) {
                presets().save(name, data.matchName, data.rows, data.omitted);
                status.text =
                    'Preset saved. Use Presets to edit/export or Add Effect to create a new instance.';
            }
        }
        function editPreset(preset) {
            var rows = FX.Parameters.rows(preset.matchName, FX.U.clone(preset.rows)),
                d = new Window('dialog', 'Edit preset');
            FX.U.assert(rows.length, 'This preset contains no public editable parameters.');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            d.add(
                'statictext',
                undefined,
                preset.name + ' [' + preset.matchName + ']'
            );
            var list = d.add('listbox', undefined, []),
                i;
            list.preferredSize = [420, 220];
            for (i = 0; i < rows.length; i++) {
                list.add(
                    'item',
                    rows[i].name + ' = ' + FX.Parameters.display(rows[i])
                );
            }
            d.add(
                'statictext',
                undefined,
                'Edit one parameter per save. Number or JSON array; only the saved preset changes.'
            );
            var presetValueHost = d.add('group');
            presetValueHost.orientation = 'stack';
            presetValueHost.alignChildren = ['fill', 'center'];
            presetValueHost.minimumSize.height = 24;
            var value = presetValueHost.add('edittext', undefined, '');
            value.minimumSize = [180, 24];
            var presetMenu = presetValueHost.add('dropdownlist', undefined, []);
            presetMenu.minimumSize = [180, 24];
            presetMenu.fxPresetMenu = true;
            list.onChange = function () {
                if (list.selection) {
                    var selectedRow = rows[list.selection.index], c, item;
                    presetMenu.removeAll();
                    presetMenu.visible = !!(selectedRow.control && selectedRow.control.kind === 'menu');
                    value.visible = !presetMenu.visible;
                    if (presetMenu.visible) {
                        for (c = 0; c < selectedRow.control.choices.length; c++) {
                            item = presetMenu.add('item', selectedRow.control.choices[c].label);
                            item.fxValue = selectedRow.control.choices[c].value;
                            if (item.fxValue === selectedRow.value) { presetMenu.selection = item; }
                        }
                    }
                    value.text = FX.JSON.stringify(
                        rows[list.selection.index].value
                    );
                }
            };
            list.selection = 0;
            list.onChange();
            button(d, 'Save preset', function () {
                FX.U.assert(list.selection, 'Choose a parameter');
                var index = list.selection.index,
                    v;
                if (presetMenu.visible) {
                    FX.U.assert(presetMenu.selection, 'Choose a dropdown option');
                    v = presetMenu.selection.fxValue;
                } else {
                    v = FX.JSON.parse(value.text);
                }
                FX.Validate.value(rows[index].valueType, v);
                rows[index].value = v;
                presets().save(
                    preset.name,
                    preset.matchName,
                    rows,
                    preset.omitted + preset.rows.length - rows.length,
                    preset.id
                );
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            showDialog(d);
        }
        function presetDialog() {
            if (busy || initializing || dialogs.length) {
                return;
            }
            var library = presets();
            while (!disposed) {
                var entries = library.list(),
                    action = null,
                    selectedId = null,
                    d = new Window('dialog', 'Effect presets');
                d.orientation = 'column';
                d.alignChildren = 'fill';
                d.add(
                    'statictext',
                    undefined,
                    'Single-effect static presets. No sets, keyframes or expressions.'
                );
                var list = d.add('listbox', undefined, []),
                    i;
                list.preferredSize = [460, 240];
                for (i = 0; i < entries.length; i++) {
                    list.add(
                        'item',
                        entries[i].name +
                            ' [' +
                            entries[i].matchName +
                            '] / ' +
                            entries[i].rows.length +
                            ' parameters'
                    );
                }
                if (entries.length) {
                    list.selection = 0;
                }
                function option(title, id, requiresPreset) {
                    var b = button(d, title, function () {
                        FX.U.assert(
                            !requiresPreset || list.selection,
                            'Choose a preset.'
                        );
                        selectedId = list.selection
                            ? entries[list.selection.index].id
                            : null;
                        action = id;
                        d.close(1);
                    });
                    b.enabled = !requiresPreset || entries.length > 0;
                    return b;
                }
                var current = selected(),
                    fresh =
                        scanner.basic &&
                        !scanner.basic.stale &&
                        !presentationFailed,
                    choice = FX.Presentation.selectionState(current, fresh);
                option('Save selected effect...', 'new', false).enabled =
                    !!fresh &&
                    !!current.instances.length &&
                    choice.action === 'edit';
                option('Edit values...', 'edit', true);
                option('Rename...', 'rename', true);
                option('Delete...', 'delete', true);
                var applyPreset = option(
                    'Apply to selected effects...',
                    'apply',
                    true
                );
                list.onChange = function () {
                    applyPreset.enabled =
                        !!fresh &&
                        !!list.selection &&
                        !!current.instances.length &&
                        choice.analyzed &&
                        choice.same &&
                        entries[list.selection.index].matchName ===
                            current.instances[0].matchName;
                };
                list.onChange();
                option('Import presets...', 'import', false);
                option('Export all presets...', 'export', false);
                button(d, 'Close', function () {
                    d.close(0);
                });
                if (showDialog(d) !== 1) {
                    return;
                }
                var p = selectedId ? library.get(selectedId) : null,
                    file,
                    storage,
                    name;
                if (action === 'new') {
                    saveEffectPreset();
                } else if (action === 'edit') {
                    editPreset(p);
                } else if (action === 'rename') {
                    name = inputText(
                        'Rename preset',
                        'New preset name',
                        p.name
                    );
                    if (name !== null) {
                        library.save(
                            name,
                            p.matchName,
                            p.rows,
                            p.omitted,
                            p.id
                        );
                    }
                } else if (action === 'delete') {
                    if (
                        confirm(
                            'Delete preset "' +
                                p.name +
                                '"? Stored backups remain available.'
                        )
                    ) {
                        library.remove(p.id);
                    }
                } else if (action === 'apply') {
                    pasteParameters(p);
                    return;
                } else if (action === 'import') {
                    file = File.openDialog(
                        'Import FX Exchanger presets',
                        'JSON:*.json'
                    );
                    if (file) {
                        storage = new FX.Store();
                        var raw = storage.readText(file),
                            doc = FX.Presets.validate(FX.JSON.parse(raw));
                        if (
                            confirm(
                                'Merge ' +
                                    doc.presets.length +
                                    ' presets? Existing IDs/names will not be overwritten; conflicts cancel the whole import.'
                            )
                        ) {
                            var result = library.importText(raw);
                            status.text =
                                result.added +
                                ' presets imported; ' +
                                result.skipped +
                                ' identical presets skipped.';
                        }
                    }
                } else if (action === 'export') {
                    file = File.saveDialog(
                        'Export all FX Exchanger presets',
                        'JSON:*.json'
                    );
                    if (file) {
                        new FX.Store().writeText(file, library.exportText());
                    }
                }
            }
        }
        function chooseEffect() {
            var all = adapter.inventory(),
                saved = [],
                presetLoadFailed = false;
            try {
                saved = presets().list();
            } catch (presetError) {
                presetLoadFailed = true;
                diagnostics.error('presets-load', presetError);
            }
            FX.U.assert(
                all.length || saved.length,
                'No effects are available to apply.'
            );
            var d = new Window('dialog', 'Choose effect to apply');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            if (presetLoadFailed) {
                d.add(
                    'statictext',
                    undefined,
                    'Saved presets unavailable. Original files preserved; see Help > Diagnostics.'
                );
            }
            var kind = dropdown(d, ['All effects', 'Saved presets']);
            var q = d.add('edittext', undefined, ''),
                list = d.add('listbox', undefined, []),
                items = [];
            list.preferredSize = [360, 260];
            function fill() {
                list.removeAll();
                items = [];
                var i,
                    source = kind.selection.index === 1 ? saved : all,
                    label,
                    presetMode = kind.selection.index === 1;
                for (i = 0; i < source.length; i++) {
                    label = presetMode ? source[i].name : source[i].displayName;
                    if (
                        FX.Filters.text(
                            label + ' ' + source[i].matchName,
                            q.text
                        )
                    ) {
                        items.push(source[i]);
                        list.add(
                            'item',
                            label + ' [' + source[i].matchName + ']'
                        );
                    }
                }
            }
            q.onChanging = fill;
            kind.onChange = fill;
            fill();
            var r = row(d);
            button(r, 'Cancel', function () {
                d.close(0);
            });
            button(r, 'Choose', function () {
                FX.U.assert(list.selection, 'Choose an effect');
                effectMatchName = items[list.selection.index].matchName;
                effectPreset =
                    kind.selection.index === 1
                        ? FX.U.clone(items[list.selection.index])
                        : null;
                if (effectPreset) {
                    var publicPresetRows = FX.Parameters.rows(effectPreset.matchName, effectPreset.rows);
                    FX.U.assert(publicPresetRows.length, 'This preset contains no public effect parameters.');
                    effectPreset.omitted += effectPreset.rows.length - publicPresetRows.length;
                    effectPreset.rows = publicPresetRows;
                }
                effectDisplayName = effectPreset
                    ? effectPreset.name
                    : items[list.selection.index].displayName;
                d.close(1);
            });
            showDialog(d);
        }
        function pickRows(config, title) {
            var publicRows = [], pi, profile = FX.Parameters.fromConfig(config);
            if (config) {
                for (pi = 0; pi < config.properties.length; pi++) {
                    if (!FX.Parameters.blocked(profile, config.properties[pi].path,
                        config.properties[pi].name, config.properties[pi].valueType)) {
                        publicRows.push(config.properties[pi]);
                    }
                }
            }
            FX.U.assert(
                config && publicRows.length,
                'No compatible static parameters are available.'
            );
            var d = new Window('dialog', title);
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var list = d.add('listbox', undefined, [], { multiselect: true });
            list.preferredSize = [400, 260];
            var i,
                out = null;
            for (i = 0; i < publicRows.length; i++) {
                var p = publicRows[i];
                list.add(
                    'item',
                    (p.name || FX.Config.key(p.path)) +
                        ' = ' +
                        FX.Parameters.display(p)
                );
            }
            d.add(
                'statictext',
                undefined,
                config.unsupported.length +
                    ' unsupported/animated/expression properties excluded.'
            );
            var r = row(d);
            button(r, 'Select All', function () {
                var j;
                for (j = 0; j < list.items.length; j++) {
                    list.items[j].selected = true;
                }
            });
            button(r, 'Cancel', function () {
                d.close(0);
            });
            button(r, 'Use selected', function () {
                var s = list.selection || [],
                    j;
                if (!FX.U.array(s)) {
                    s = [s];
                }
                FX.U.assert(s.length, 'Select parameters');
                out = [];
                for (j = 0; j < s.length; j++) {
                    out.push(FX.U.clone(publicRows[s[j].index]));
                }
                d.close(1);
            });
            showDialog(d);
            return out;
        }
        function copyReference() {
            var s = selected(),
                available = comparableInstances(),
                d = new Window('dialog', 'Choose copy reference');
            FX.U.assert(s.instances.length, 'Select target occurrences first.');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var chosenConfiguration = null;
            var list = d.add('listbox', undefined, []),
                i;
            list.preferredSize = [400, 200];
            for (i = 0; i < available.length; i++) {
                list.add(
                    'item',
                    available[i].compName +
                        ' / ' +
                        available[i].layerName +
                        ' / #' +
                        available[i].effectIndex +
                        ' ' +
                        available[i].effectName
                );
            }
            button(d, 'Use analyzed result', function () {
                FX.U.assert(
                    list.selection,
                    'Choose an analyzed reference occurrence.'
                );
                chosenConfiguration =
                    available[list.selection.index].configuration;
                d.close(1);
            });
            d.add(
                'statictext',
                undefined,
                'Optional: select ONE effect in After Effects Effect Controls first.',
                { multiline: true }
            );
            button(d, 'Use Effect Controls reference', function () {
                var e = adapter.selectedEffect();
                FX.U.assert(
                    String(e.matchName) === s.instances[0].matchName,
                    'Reference must be the same effect matchName.'
                );
                chosenConfiguration = adapter.capture(e);
                d.close(1);
            });
            button(d, 'Cancel', function () {
                d.close(0);
            });
            if (showDialog(d) === 1 && chosenConfiguration) {
                sourceRows = pickRows(
                    chosenConfiguration,
                    'Copy selected static parameters'
                );
            }
        }
        function chooseGrouping() {
            FX.U.assert(
                scanner.basic && !scanner.basic.stale,
                'Run Scan and select an effect occurrence first'
            );
            var s = selected().instances;
            FX.U.assert(s.length, 'Select an occurrence first');
            FX.U.assert(
                s[0].configuration,
                'Select an occurrence and use Read Parameters first.'
            );
            var chosen = pickRows(
                s[0].configuration,
                'Group by selected parameters'
            );
            if (chosen) {
                paths = [];
                var i;
                for (i = 0; i < chosen.length; i++) {
                    paths.push(chosen[i].path);
                }
            }
            return !!(chosen && chosen.length);
        }
        function filterDialog() {
            var propertyFilters = FX.U.clone(filters.properties || []);
            if (filters.property) {
                propertyFilters.push(FX.U.clone(filters.property));
            }
            var d = new Window('dialog', 'Layer and effect filters');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var cn = d.add('edittext', undefined, filters.compName || '');
            cn.helpTip = 'Composition name contains';
            var type = dropdown(d, [
                    'Any',
                    'Adjustment',
                    'Text',
                    'Shape',
                    'Solid',
                    'Footage',
                    'Precomposition',
                    'Null',
                    'Camera',
                    'Light',
                    'Other'
                ]),
                labels = ['Any label'],
                i;
            for (i = 0; i < type.items.length; i++) {
                if (type.items[i].text === filters.type) {
                    type.selection = i;
                }
            }
            for (i = 0; i <= 16; i++) {
                labels.push('Label index ' + i);
            }
            var label = dropdown(d, labels);
            if (filters.label !== undefined && filters.label !== null) {
                label.selection = filters.label + 1;
            }
            var flags = [
                    'locked',
                    'enabled',
                    'shy',
                    'threeD',
                    'selected',
                    'adjustment'
                ],
                flagLabels = [
                    'Locked',
                    'Enabled',
                    'Shy',
                    '3D',
                    'Selected in AE',
                    'Adjustment'
                ],
                controls = [];
            for (i = 0; i < flags.length; i++) {
                var r = row(d);
                r.add('statictext', undefined, flagLabels[i]);
                controls.push(dropdown(r, ['Any', 'Yes', 'No']));
                if (filters[flags[i]] === true) {
                    controls[i].selection = 1;
                } else if (filters[flags[i]] === false) {
                    controls[i].selection = 2;
                }
            }
            var effect = d.add('edittext', undefined, filters.effect || '');
            effect.helpTip = 'Effect name or matchName contains';
            var presence = dropdown(d, [
                'Any effects / no effects',
                'Has effects',
                'No effects'
            ]);
            if (filters.effectMode === 'has') {
                presence.selection = 1;
            } else if (filters.effectMode === 'none') {
                presence.selection = 2;
            }
            var fxState = dropdown(d, [
                'Any effect state',
                'Effect enabled',
                'Effect disabled'
            ]);
            if (filters.effectEnabled === true) {
                fxState.selection = 1;
            } else if (filters.effectEnabled === false) {
                fxState.selection = 2;
            }
            var animation = dropdown(d, [
                'Any',
                'Static',
                'Animated',
                'Expression',
                'Partial'
            ]);
            animation.helpTip =
                'Uses known analysis metadata only; unknown is never Static.';
            for (i = 0; i < animation.items.length; i++) {
                if (animation.items[i].text === filters.animation) {
                    animation.selection = i;
                }
            }
            var propertyText = d.add(
                'statictext',
                undefined,
                propertyFilters.length
                    ? propertyFilters.length + ' property value filters active'
                    : 'No property value filter'
            );
            button(d, 'Property value...', function () {
                var s = selected().instances;
                FX.U.assert(
                    s.length,
                    'Select a scanned occurrence before choosing a property'
                );
                FX.U.assert(
                    s[0].configuration,
                    'Select an effect and use Read Parameters first. No analysis starts from this dialog.'
                );
                var ps = pickRows(
                    s[0].configuration,
                    'Choose properties for filtering'
                );
                if (ps) {
                    var pi, v;
                    for (pi = 0; pi < ps.length; pi++) {
                        v = prompt(
                            'Exact value for ' +
                                ps[pi].name +
                                ' (number or vector)',
                            FX.JSON.stringify(ps[pi].value)
                        );
                        if (v === null) {
                            return;
                        }
                        ps[pi].value = FX.JSON.parse(v);
                    }
                    FX.Validate.rows(ps);
                    propertyFilters = ps;
                    propertyText.text = ps.length + ' property filters active';
                }
            });
            var buttons = row(d);
            button(buttons, 'Clear', function () {
                filters = {};
                d.close(1);
                render();
            });
            button(buttons, 'Cancel', function () {
                d.close(0);
            });
            button(buttons, 'Use filters', function () {
                filters.property = null;
                filters.properties = propertyFilters;
                filters.animation = animation.selection.text;
                filters.compName = cn.text;
                filters.type = type.selection.text;
                filters.label = null;
                if (label.selection.index) {
                    filters.label = label.selection.index - 1;
                }
                for (var j = 0; j < flags.length; j++) {
                    filters[flags[j]] = null;
                    if (controls[j].selection.index) {
                        filters[flags[j]] = controls[j].selection.index === 1;
                    }
                }
                filters.effect = effect.text;
                filters.effectMode = ['any', 'has', 'none'][
                    presence.selection.index
                ];
                filters.effectEnabled = null;
                if (fxState.selection.index) {
                    filters.effectEnabled = fxState.selection.index === 1;
                }
                d.close(1);
                render();
            });
            showDialog(d);
        }
        function compareDialog() {
            FX.U.assert(
                scanner.inventory() &&
                    scanner.inventory().analysisState === 'analyzed',
                'Run Configuration Analysis before comparing configurations.'
            );
            var scan = scanner.current(),
                choices = FX.Grouping.build(
                    comparableInstances(),
                    'type-config',
                    null,
                    true
                );
            FX.U.assert(
                choices.length >= 2,
                'At least two configuration groups are needed'
            );
            var d = new Window('dialog', 'Compare configurations');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var a = dropdown(d, []),
                b = dropdown(d, []),
                i;
            for (i = 0; i < choices.length; i++) {
                var title =
                    choices[i].name +
                    ' / ' +
                    choices[i].layerType +
                    ' / ' +
                    FX.Presentation.groupTitle(choices[i]);
                a.add('item', 'A: ' + title);
                b.add('item', 'B: ' + title);
            }
            a.selection = 0;
            b.selection = 1;
            var showAll = d.add('checkbox', undefined, 'Show all properties'),
                list = d.add('listbox', undefined, [], {
                    multiselect: true,
                    numberOfColumns: 3,
                    showHeaders: true,
                    columnTitles: ['Property', 'A', 'B'],
                    columnWidths: [220, 110, 110]
                });
            list.preferredSize = [460, 260];
            var diff = [],
                copyIntent = null;
            function fill() {
                list.removeAll();
                if (!a.selection || !b.selection) {
                    return;
                }
                var ga = choices[a.selection.index],
                    gb = choices[b.selection.index];
                if (ga.matchName !== gb.matchName) {
                    list.add(
                        'item',
                        'Choose groups with the same effect matchName'
                    );
                    diff = [];
                    return;
                }
                diff = FX.Config.diff(
                    ga.instances[0].configuration,
                    gb.instances[0].configuration,
                    showAll.value
                );
                var j, n;
                for (j = 0; j < diff.length; j++) {
                    n = list.add('item', diff[j].name);
                    n.subItems[0].text = diff[j].a
                        ? FX.Parameters.display(diff[j].a)
                        : 'Unavailable';
                    n.subItems[1].text = diff[j].b
                        ? FX.Parameters.display(diff[j].b)
                        : 'Unavailable';
                }
            }
            a.onChange = fill;
            b.onChange = fill;
            showAll.onClick = fill;
            fill();
            function copy(reverse) {
                var s = list.selection || [],
                    rows = [],
                    j,
                    r;
                if (!FX.U.array(s)) {
                    s = [s];
                }
                for (j = 0; j < s.length; j++) {
                    r = diff[s[j].index];
                    FX.U.assert(
                        r && r.comparable,
                        'Only compatible static properties can be copied'
                    );
                    rows.push(FX.U.clone(reverse ? r.b : r.a));
                }
                FX.U.assert(rows.length, 'Select the parameters to copy');
                var dest =
                    choices[reverse ? a.selection.index : b.selection.index];
                copyIntent = { targets: dest.instances, rows: rows };
                d.close(1);
            }
            var r = row(d);
            button(r, 'Copy A → B', function () {
                copy(false);
            });
            button(r, 'Copy B → A', function () {
                copy(true);
            });
            button(r, 'Close', function () {
                d.close(0);
            });
            if (showDialog(d) === 1 && copyIntent && !disposed) {
                confirmAndExecute(copyIntent.targets, 'copy', {
                    rows: copyIntent.rows
                });
            }
        }
        function issuesDialog() {
            FX.U.assert(lastReport, 'No operation results');
            var d = new Window('dialog', 'Operation results');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var outcomeSummary = d.add('statictext', undefined, FX.Presentation.reportSummary(lastReport), { multiline: true });
            outcomeSummary.preferredSize = [440, 54];
            var list = d.add('listbox', undefined, []),
                i;
            list.preferredSize = [440, 130];
            list.visible = lastReport.issues.length > 0;
            list.maximumSize.height = list.visible ? 10000 : 0;
            var details = d.add(
                'edittext',
                undefined,
                FX.JSON.stringify(lastReport),
                { multiline: true, scrolling: true, readonly: true }
            );
            details.preferredSize = [440, 180];
            details.visible = false;
            details.maximumSize.height = 0;
            button(d, 'Technical details', function () {
                details.visible = !details.visible;
                details.maximumSize.height = details.visible ? 10000 : 0;
                d.layout.layout(true);
            });
            button(d, 'Save report...', function () {
                var file = File.saveDialog('Save operation report', 'JSON:*.json');
                if (file) { new FX.Store().writeText(file, FX.JSON.stringify(lastReport)); }
            });
            for (i = 0; i < lastReport.issues.length; i++) {
                var issue = lastReport.issues[i];
                list.add(
                    'item',
                    (issue.target
                        ? issue.target.compName + ' / ' + issue.target.layerName
                        : 'Batch') +
                        ': ' +
                        issue.reason
                );
            }
            button(d, 'Locate selected', function () {
                FX.U.assert(list.selection, 'Choose an issue');
                var target = lastReport.issues[list.selection.index].target;
                FX.U.assert(target, 'This is a batch-level issue.');
                adapter.locate(target);
            });
            button(d, 'Close', function () {
                d.close();
            });
            showDialog(d);
        }
        function diagnosticDialog() {
            var d = new Window('dialog', 'FX Exchanger diagnostics');
            d.orientation = 'column';
            d.alignChildren = 'fill';
            var text = d.add('edittext', undefined, diagnostics.text(), {
                multiline: true,
                scrolling: true,
                readonly: true
            });
            text.preferredSize = [420, 240];
            button(d, 'Save log...', function () {
                var file = File.saveDialog(
                    'Save diagnostic JSON',
                    'JSON:*.json'
                );
                if (file) {
                    var logStore = new FX.Store();
                    logStore.writeText(file, diagnostics.text());
                }
            });
            button(d, 'Close', function () {
                d.close();
            });
            showDialog(d);
        }
        scope.selection = 0;
        var i;
        for (i = 0; i < scopes.length; i++) {
            if (scopes[i] === state.preferences.scope) {
                scope.selection = i;
            }
        }
        groupBy.selection = 7;
        mainView.selection = 0;
        choose.enabled = scope.selection.index === 1;
        var controller = {
            root: shell,
            content: root,
            viewport: {
                resize: layoutViewport,
                scrollTo: scrollTo,
                state: function () {
                    return viewportState;
                }
            },
            scanner: scanner,
            adapter: adapter,
            batch: batch,
            results: tree,
            isPanel: isPanel,
            dispose: function () {
                if (disposed) {
                    return;
                }
                disposed = true;
                cancelEditorContinuation();
                pendingParameterRefresh = null;
                pendingRestore = null;
                sessionEpoch++;
                closeDialogs();
                scanner.cancel();
                diagnostics.add(
                    'lifecycle',
                    '',
                    'disposed; pending tasks cancelled'
                );
                scanner.onDone = scanner.onProgress = function () {};
                delete $.global[callback];
                delete $.global[editorCallback];
            },
            scan: guard(runScan, 'scan-start'),
            analyze: guard(analyzeSelection),
            editorTask: function () { return editorContinueTask; },
            render: render,
            diagnostics: diagnostics,
            applySearch: applySearch,
            selected: selected
        };
        w.fxController = controller;
        w.onClose = function () {
            controller.dispose();
            return true;
        };
        w.onResizing = w.onResize = guard(function () {
            w.layout.resize();
            layoutViewport();
        }, 'resize');
        layoutReady = true;
        body.layout = { layout: layoutViewport, resize: layoutViewport };
        updateActions();
        w.minimumSize = [280, 160];
        w.layout.layout(true);
        layoutViewport();
        if (!isPanel) {
            w.size = [480, 680];
            w.center();
            w.show();
        }
        if (startupFailed) {
            status.text =
                'Preferences could not be loaded; using defaults. See Help > Diagnostics.';
        }
        initializing = false;
        return w;
    }
    return { start: start };
})();
