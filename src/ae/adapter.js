FX.AfterEffectsAdapter = function (diagnostics) {
    this.diagnostics = diagnostics;
};
FX.AfterEffectsAdapter.prototype.inventory = function () {
    var out = [],
        list = app.effects,
        i,
        e,
        seen = {};
    for (i = 0; i < list.length; i++) {
        try {
            e = list[i];
            if (!e.matchName || seen['$' + e.matchName]) {
                continue;
            }
            seen['$' + e.matchName] = true;
            out.push({
                matchName: String(e.matchName),
                displayName: String(e.displayName),
                category: String(e.category || ''),
                version: e.version ? String(e.version) : null
            });
        } catch (error) {
            this.diagnostics.add('inventory', '', 'read-error');
        }
    }
    out.sort(function (a, b) {
        var x = a.displayName.toLowerCase(),
            y = b.displayName.toLowerCase();
        if (x < y) {
            return -1;
        }
        if (x > y) {
            return 1;
        }
        return 0;
    });
    return out;
};
FX.AfterEffectsAdapter.prototype.version = function () {
    return String(app.version);
};
FX.AfterEffectsAdapter.prototype.checkForUpdates = function (installed) {
    FX.U.assert(typeof system !== 'undefined' && typeof system.callSystem === 'function',
        'Update checks are unavailable in this host. Open github.com/datacg/fxhx/releases.');
    FX.U.assert(this.networkAllowed() !== false,
        'Enable Preferences > Scripting & Expressions > "Allow Scripts to Write Files and Access Network", or use Open Releases.');
    var raw = String(system.callSystem(FX.Updates.checkCommand())).replace(/^\s+|\s+$/g, '');
    if (raw === 'FXHX_NO_RELEASE') { return { unpublished: true }; }
    FX.U.assert(raw !== 'FXHX_UPDATE_ERROR' && raw.length > 0,
        'Could not check GitHub. Check your connection or try again later.');
    return FX.Updates.release(raw, installed);
};
// true/false when the host preference is readable; null when unknown.
FX.AfterEffectsAdapter.prototype.networkAllowed = function () {
    try {
        if (typeof app !== 'undefined' && app.preferences &&
            typeof app.preferences.getPrefAsLong === 'function') {
            return app.preferences.getPrefAsLong('Main Pref Section',
                'Pref_SCRIPTING_FILE_NETWORK_SECURITY') === 1;
        }
    } catch (ignoredPreference) {}
    return null;
};
FX.AfterEffectsAdapter.prototype.openReleases = function () {
    FX.U.assert(typeof system !== 'undefined' && typeof system.callSystem === 'function',
        'Open github.com/datacg/fxhx/releases in your browser.');
    system.callSystem(FX.Updates.browserCommand());
};
FX.AfterEffectsAdapter.prototype.project = function () {
    return app.project;
};
FX.AfterEffectsAdapter.prototype.undo = function (label, fn) {
    app.beginUndoGroup('FXHX - ' + label);
    try {
        return fn();
    } finally {
        app.endUndoGroup();
    }
};
FX.AfterEffectsAdapter.prototype.activeComp = function () {
    var comp = app.project.activeItem;
    FX.U.assert(comp instanceof CompItem, 'Open a composition first.');
    return comp;
};
FX.AfterEffectsAdapter.prototype.selectedLayers = function () {
    var layers = this.activeComp().selectedLayers;
    FX.U.assert(layers.length > 0, 'Select one or more layers.');
    return layers;
};
FX.AfterEffectsAdapter.prototype.selectedEffect = function () {
    var comp = this.activeComp(),
        props = comp.selectedProperties,
        out = [],
        i,
        p,
        j,
        found;
    for (i = 0; i < props.length; i++) {
        p = props[i];
        while (p && !p.isEffect) {
            p = p.parentProperty;
        }
        if (p) {
            found = false;
            for (j = 0; j < out.length; j++) {
                if (out[j] === p) {
                    found = true;
                }
            }
            if (!found) {
                out.push(p);
            }
        }
    }
    FX.U.assert(
        out.length === 1,
        'Select exactly one effect (or one of its properties) in Effect Controls.'
    );
    return out[0];
};
FX.AfterEffectsAdapter.prototype.valueType = function (prop) {
    var names = [
            'OneD',
            'TwoD',
            'ThreeD',
            'TwoD_SPATIAL',
            'ThreeD_SPATIAL',
            'COLOR'
        ],
        i,
        t = prop.propertyValueType;
    for (i = 0; i < names.length; i++) {
        if (t === PropertyValueType[names[i]]) {
            return names[i];
        }
    }
    if (t === PropertyValueType.CUSTOM_VALUE) {
        return 'custom';
    }
    if (
        t === PropertyValueType.LAYER_INDEX ||
        t === PropertyValueType.MASK_INDEX
    ) {
        return 'reference';
    }
    if (t === PropertyValueType.NO_VALUE) {
        return 'no-value';
    }
    return 'static-only';
};
FX.AfterEffectsAdapter.prototype._capture = function (effect, paths) {
    var self = this,
        out = {
            schemaVersion: 1,
            effectMatchName: String(effect.matchName),
            enabled: true,
            properties: [],
            unsupported: [],
            excluded: [],
            states: []
        },
        visited = 0,
        parameterProfile = this.parameterProfile(effect);
    out.parameterProfile = parameterProfile;
    try {
        out.enabled = effect.canSetEnabled ? !!effect.enabled : true;
    } catch (enabledError) {
        out.unsupported.push({
            path: [{ matchName: out.effectMatchName, index: 1 }],
            reason: 'read-error'
        });
    }
    function skip(path, reason, name) {
        if (reason === 'host-system-parameter' || reason === 'internal-parameter') {
            out.excluded.push({ path: path, reason: reason, name: name || '' });
            self.diagnostics.add('capture', out.effectMatchName, reason);
            return;
        }
        out.unsupported.push({ path: path, reason: reason });
        if (reason !== 'keyframed' && reason !== 'expression') {
            state(path, 'Unsupported', name || '', null, null, null);
        }
        self.diagnostics.add('capture', out.effectMatchName, reason);
    }
    function state(path, kind, name, keys, expression, expressionEnabled, valueType) {
        var item = {
                path: path,
                state: kind,
                name: name,
                keyCount: keys,
                expressionPresent: expression,
                expressionEnabled: expressionEnabled
            },
            i;
        if (valueType) {
            item.valueType = valueType;
        }
        for (i = 0; i < out.states.length; i++) {
            if (FX.Config.key(out.states[i].path) === FX.Config.key(path)) {
                out.states[i] = item;
                return;
            }
        }
        out.states.push(item);
    }
    function read(p, path) {
        var name = String(p.name || p.matchName),
            reason = FX.Parameters.blocked(parameterProfile, path, name),
            t,
            v,
            n,
            j,
            copy = [];
        if (reason) {
            skip(path, reason, name);
            return;
        }
        t = self.valueType(p);
        reason = FX.Parameters.blocked(parameterProfile, path, name, t);
        if (reason) {
            skip(path, reason, name);
            return;
        }
        if (
            !FX.U.contains(
                [
                    'OneD',
                    'TwoD',
                    'ThreeD',
                    'TwoD_SPATIAL',
                    'ThreeD_SPATIAL',
                    'COLOR'
                ],
                t
            )
        ) {
            skip(path, t, String(p.name || p.matchName));
            return;
        }
        var keys = p.numKeys,
            expression = '',
            expressionEnabled = null,
            kind = 'Static';
        if (
            typeof keys !== 'number' ||
            !isFinite(keys) ||
            keys < 0 ||
            keys !== Math.floor(keys)
        ) {
            skip(path, 'animation-unknown');
            return;
        }
        if (p.canSetExpression) {
            expression = String(p.expression || '');
        }
        if (expression.length) {
            kind = 'Expression-driven';
            try {
                expressionEnabled = !!p.expressionEnabled;
            } catch (expressionStateError) {
                self.diagnostics.add(
                    'capture',
                    out.effectMatchName,
                    'expression-state-unavailable'
                );
            }
        }
        if (keys > 0) {
            kind = expression.length ? 'Mixed' : 'Keyframed';
        }
        state(
            path,
            kind,
            String(p.name || p.matchName),
            keys,
            expression.length > 0,
            expressionEnabled,
            t
        );
        var control = self.parameterControl(effect, p, path, parameterProfile, t),
            capturedState = FX.Config.state(out, path);
        if (control && capturedState) {
            capturedState.control = control;
        }
        if (control && control.kind === 'unavailable-menu') {
            skip(path, 'menu-labels-unavailable', name);
            return;
        }
        if (keys > 0) {
            // A numeric snapshot is for review / clearing keys only. It never
            // makes a keyframed property a comparable static property.
            if (!expression.length) {
                try {
                    v = p.value;
                    FX.Validate.value(t, v);
                    if (!control || control.kind !== 'menu' || FX.Parameters.menuValue(control, v) !== null) {
                        capturedState.currentValue = FX.U.clone(v);
                    }
                } catch (snapshotError) {
                    self.diagnostics.add('capture', out.effectMatchName, 'keyframed-current-value-unavailable');
                }
            }
            skip(path, 'keyframed');
            return;
        }
        if (expression.length > 0) {
            skip(path, 'expression');
            return;
        }
        v = p.value;
        if (t === 'OneD') {
            if (typeof v !== 'number' || !isFinite(v)) {
                skip(path, 'read-error');
                return;
            }
        } else {
            if (t === 'COLOR') {
                n = 4;
            } else if (t === 'TwoD' || t === 'TwoD_SPATIAL') {
                n = 2;
            } else {
                n = 3;
            }
            if (!v || v.length !== n) {
                skip(path, 'read-error');
                return;
            }
            for (j = 0; j < v.length; j++) {
                if (typeof v[j] !== 'number' || !isFinite(v[j])) {
                    skip(path, 'read-error');
                    return;
                }
                copy.push(v[j]);
            }
            v = copy;
        }
        var captured = {
            path: path,
            valueType: t,
            value: v,
            name: String(p.name || p.matchName)
        };
        if (control) {
            captured.control = control;
        }
        if (control && control.kind === 'menu' && FX.Parameters.menuValue(control, v) === null) {
            skip(path, 'menu-value-unavailable', name);
            return;
        }
        out.properties.push(captured);
    }
    function walk(group, path, depth) {
        var i, p, next, reason;
        if (depth > 24) {
            skip(
                path.length
                    ? path
                    : [{ matchName: out.effectMatchName, index: 1 }],
                'limit'
            );
            return;
        }
        for (i = 1; i <= group.numProperties; i++) {
            next = path.concat([{ matchName: '', index: i }]);
            visited++;
            if (visited > 5000) {
                skip(next, 'limit');
                return;
            }
            try {
                p = group.property(i);
                next[next.length - 1].matchName = String(p.matchName || '');
                reason = FX.Parameters.blocked(parameterProfile, next, String(p.name || p.matchName));
                if (reason) {
                    skip(next, reason, String(p.name || p.matchName));
                } else if (p.propertyType !== PropertyType.PROPERTY) {
                    walk(p, next, depth + 1);
                } else {
                    read(p, next);
                }
            } catch (error) {
                skip(next, 'read-error');
            }
        }
    }
    if (paths && paths.length) {
        for (var pi = 0; pi < paths.length; pi++) {
            try {
                var selected = self.resolveProperty(effect, paths[pi]);
                if (selected.propertyType !== PropertyType.PROPERTY) {
                    skip(paths[pi], 'static-only');
                } else {
                    read(selected, paths[pi]);
                }
            } catch (pathError) {
                skip(paths[pi], 'read-error');
            }
        }
    } else {
        try {
            walk(effect, [], 0);
        } catch (error2) {
            skip([{ matchName: out.effectMatchName, index: 1 }], 'read-error');
        }
    }
    return out;
};
FX.AfterEffectsAdapter.prototype.parameterProfile = function (effect) {
    var matchName = String(effect.matchName),
        identified = FX.Parameters.profile(matchName, []),
        names = [], i;
    if (identified || /^ADBE /.test(matchName)) {
        return identified;
    }
    for (i = 1; i <= effect.numProperties; i++) {
        try {
            names.push(String(effect.property(i).name || ''));
        } catch (ignoredName) {}
    }
    return FX.Parameters.profile(matchName, names);
};
FX.AfterEffectsAdapter.prototype.parameterControl = function (effect, property, path, profile, valueType) {
    if (valueType !== 'OneD') {
        return null;
    }
    var c = { kind: 'number' }, labels = null, dropdown = false, units;
    try { labels = FX.Parameters.choices(property.propertyParameters); } catch (ignoredLabels) {}
    try { dropdown = property.isDropdownEffect === true; } catch (ignoredDropdown) {}
    if (labels) {
        c = { kind: 'menu', choices: labels, source: 'host' };
    } else if (profile === 'deep-glow-2' && FX.Parameters.normalize(property.name) === 'blendmode') {
        // Audited in the supplied UI: Screen is index 1, Add is index 2.
        c = { kind: 'menu', choices: [{ value: 1, label: 'Screen' }, { value: 2, label: 'Add' }], source: 'deep-glow-2' };
    } else if (dropdown) {
        return { kind: 'unavailable-menu' };
    }
    try { if (property.hasMin) { c.min = property.minValue; } } catch (ignoredMin) {}
    try { if (property.hasMax) { c.max = property.maxValue; } } catch (ignoredMax) {}
    try {
        units = property.unitsText || property.unitText;
        if (typeof units === 'string' && units.length <= 120) { c.units = units; }
    } catch (ignoredUnits) {}
    if (c.source === 'deep-glow-2' &&
        ((c.min !== undefined && c.min !== 1) || (c.max !== undefined && c.max !== 2))) {
        return { kind: 'unavailable-menu' };
    }
    if (c.kind === 'number' && c.min === undefined && c.max === undefined && !c.units) {
        return null;
    }
    FX.Validate.control(c);
    return c;
};
FX.AfterEffectsAdapter.prototype.parameterBlock = function (effect, path, valueType, profile) {
    var reason = FX.Parameters.blocked(profile, path, '', valueType), p;
    // Check stable host paths before resolving or reading the protected field.
    if (reason && reason !== 'not-public-parameter') {
        return reason;
    }
    p = this.resolveProperty(effect, path);
    return FX.Parameters.blocked(profile, path, String(p.name || p.matchName), valueType);
};
FX.AfterEffectsAdapter.prototype.resolveProperty = function (effect, path) {
    var current = effect,
        i,
        j,
        s,
        p,
        found;
    for (i = 0; i < path.length; i++) {
        s = path[i];
        p = current.property(s.index);
        if (p && String(p.matchName || '') === s.matchName) {
            current = p;
            continue;
        }
        found = null;
        for (j = 1; j <= current.numProperties; j++) {
            p = current.property(j);
            if (String(p.matchName || '') === s.matchName) {
                FX.U.assert(!found, 'Ambiguous property path');
                found = p;
            }
        }
        FX.U.assert(found, 'Property path unavailable');
        current = found;
    }
    return current;
};
FX.AfterEffectsAdapter.prototype.layerId = function (layer) {
    try {
        return layer.id === undefined ? null : Number(layer.id);
    } catch (error) {
        return null;
    }
};
FX.AfterEffectsAdapter.prototype.layerType = function (l) {
    if (l instanceof CameraLayer) {
        return 'Camera';
    }
    if (l instanceof LightLayer) {
        return 'Light';
    }
    if (l instanceof TextLayer) {
        return 'Text';
    }
    if (l instanceof ShapeLayer) {
        return 'Shape';
    }
    if (l.nullLayer) {
        return 'Null';
    }
    if (l.adjustmentLayer) {
        return 'Adjustment';
    }
    if (l.source instanceof CompItem) {
        return 'Precomposition';
    }
    if (l.source && l.source.mainSource instanceof SolidSource) {
        return 'Solid';
    }
    if (l.source instanceof FootageItem) {
        return 'Footage';
    }
    return 'Other';
};
FX.AfterEffectsAdapter.prototype.compositions = function () {
    var out = [],
        i,
        c;
    for (i = 1; i <= app.project.numItems; i++) {
        c = app.project.item(i);
        if (c instanceof CompItem) {
            out.push({ id: c.id, name: String(c.name) });
        }
    }
    return out;
};
FX.AfterEffectsAdapter.prototype.scopeComps = function (scope, ids) {
    var out = [],
        items = [],
        i,
        c;
    if (scope === 'active') {
        return [this.activeComp()];
    }
    if (scope === 'selected') {
        items = app.project.selection;
        for (i = 0; i < items.length; i++) {
            if (items[i] instanceof CompItem) {
                out.push(items[i]);
            }
        }
    } else {
        for (i = 1; i <= app.project.numItems; i++) {
            c = app.project.item(i);
            if (
                c instanceof CompItem &&
                (scope === 'entire' || FX.U.contains(ids || [], c.id))
            ) {
                out.push(c);
            }
        }
    }
    if (scope !== 'entire') {
        FX.U.assert(out.length > 0, 'Choose one or more compositions first.');
    }
    return out;
};
FX.AfterEffectsAdapter.prototype.layerRecord = function (c, l, scanId) {
    var parade = l.property('ADBE Effect Parade');
    return {
        scanId: scanId,
        compId: c.id,
        compName: String(c.name),
        layerId: this.layerId(l),
        layerIndex: l.index,
        layerName: String(l.name),
        layerType: this.layerType(l),
        label: Number(l.label),
        locked: !!l.locked,
        enabled: !!l.enabled,
        selected: !!l.selected,
        shy: !!l.shy,
        threeD: !!l.threeDLayer,
        adjustment: !!l.adjustmentLayer,
        effectCount: parade ? parade.numProperties : 0,
        stack: [],
        stackSignature: null
    };
};
FX.AfterEffectsAdapter.prototype.effectRecord = function (l, e, index, scanId) {
    var out = FX.U.clone(l);
    out.scanId = scanId;
    delete out.stack;
    delete out.stackSignature;
    out.effectIndex = index;
    out.effectName = String(e.name);
    out.matchName = String(e.matchName);
    out.enabled = null;
    out.metadataErrors = [];
    try {
        out.enabled = e.canSetEnabled ? !!e.enabled : true;
    } catch (stateError) {
        out.metadataErrors.push('enabled-unreadable');
        this.diagnostics.add(
            'scan-metadata',
            out.matchName,
            'enabled-unreadable'
        );
    }
    out.configuration = null;
    out.fingerprint = null;
    out.analysisState = 'basic';
    return out;
};
FX.AfterEffectsAdapter.prototype.stackEntry = function (e) {
    return {
        index: e.effectIndex,
        name: e.effectName,
        matchName: e.matchName
    };
};
FX.AfterEffectsAdapter.prototype.scanCursor = function (scope, ids) {
    return {
        project: app.project,
        comps: this.scopeComps(scope, ids),
        comp: 0,
        layer: 1,
        effect: 1,
        row: null,
        done: false,
        errors: 0
    };
};
FX.AfterEffectsAdapter.prototype.scanNext = function (cursor, scanId) {
    FX.U.assert(cursor.project === app.project, 'Project changed during scan');
    var c, l, p, e, out, index;
    if (cursor.comp >= cursor.comps.length) {
        cursor.done = true;
        return null;
    }
    c = cursor.comps[cursor.comp];
    if (cursor.layer > c.numLayers) {
        cursor.comp++;
        cursor.layer = 1;
        cursor.effect = 1;
        cursor.row = null;
        return null;
    }
    try {
        l = c.layer(cursor.layer);
        if (!cursor.row) {
            cursor.row = this.layerRecord(c, l, scanId);
            cursor.effect = 1;
        }
        p = l.property('ADBE Effect Parade');
        if (p && cursor.effect <= p.numProperties) {
            index = cursor.effect++;
            try {
                e = this.effectRecord(
                    cursor.row,
                    p.property(index),
                    index,
                    scanId
                );
                cursor.row.stack.push(this.stackEntry(e));
                return { kind: 'effect', value: e };
            } catch (effectError) {
                cursor.errors++;
                cursor.row.stack.push({ index: index, error: 'unreadable' });
                this.diagnostics.add(
                    'scan-effect',
                    String(index),
                    FX.U.errorText(effectError, 'ae')
                );
                return null;
            }
        }
        out = cursor.row;
        out.stackSignature = FX.JSON.stringify(out.stack);
        delete out.stack;
        cursor.row = null;
        cursor.layer++;
        cursor.effect = 1;
        return { kind: 'layer', value: out };
    } catch (error) {
        cursor.errors++;
        cursor.layer++;
        cursor.effect = 1;
        cursor.row = null;
        this.diagnostics.add('scan-layer', '', FX.U.errorText(error, 'ae'));
        return null;
    }
};
FX.AfterEffectsAdapter.prototype.resolveLayer = function (record) {
    var c = null,
        l = null,
        i,
        x;
    for (i = 1; i <= app.project.numItems; i++) {
        x = app.project.item(i);
        if (x instanceof CompItem && x.id === record.compId) {
            c = x;
            break;
        }
    }
    FX.U.assert(c, 'Composition no longer exists; Refresh.');
    for (i = 1; i <= c.numLayers; i++) {
        x = c.layer(i);
        if (record.layerId !== null && record.layerId !== undefined) {
            if (this.layerId(x) === record.layerId) {
                l = x;
                break;
            }
        } else if (i === record.layerIndex && x.name === record.layerName) {
            l = x;
            break;
        }
    }
    FX.U.assert(l, 'Layer no longer exists; Refresh.');
    return { comp: c, layer: l };
};
FX.AfterEffectsAdapter.prototype.resolve = function (record) {
    var t = this.resolveLayer(record),
        p = t.layer.property('ADBE Effect Parade'),
        e = p && p.property(record.effectIndex);
    FX.U.assert(
        e &&
            String(e.matchName) === record.matchName &&
            String(e.name) === record.effectName,
        'Effect stack changed; Refresh.'
    );
    t.effect = e;
    return t;
};
FX.AfterEffectsAdapter.prototype.validateLayer = function (
    record,
    allowLocked
) {
    var t = this.resolveLayer(record),
        p = t.layer.property('ADBE Effect Parade'),
        stack = [],
        i,
        e;
    FX.U.assert(allowLocked || !t.layer.locked, 'Layer is locked; skipped.');
    for (i = 1; p && i <= p.numProperties; i++) {
        e = p.property(i);
        stack.push({
            index: i,
            name: String(e.name),
            matchName: String(e.matchName)
        });
    }
    FX.U.assert(
        FX.JSON.stringify(stack) === record.stackSignature,
        'Effect stack changed since scan; Refresh.'
    );
    return t;
};
FX.AfterEffectsAdapter.prototype.analyzeOccurrence = function (
    record,
    filters
) {
    var target = this.resolve(record),
        out = FX.U.clone(record),
        configuration;
    if (
        !FX.Filters.layer(
            this.layerRecord(target.comp, target.layer, record.scanId),
            filters
        )
    ) {
        return null;
    }
    try {
        out.enabled = target.effect.canSetEnabled
            ? !!target.effect.enabled
            : true;
    } catch (stateError) {
        out.enabled = null;
        this.diagnostics.add(
            'analysis-metadata',
            out.matchName,
            'enabled-unreadable'
        );
    }
    if (!FX.Filters.basicEffect(out, filters)) {
        return null;
    }
    var checks = filters.properties || [],
        requestedPaths = [],
        ci;
    if (filters.property) {
        checks = checks.concat([filters.property]);
    }
    if (checks.length) {
        for (ci = 0; ci < checks.length; ci++) {
            requestedPaths.push(checks[ci].path);
        }
        configuration = this.capture(target.effect, requestedPaths);
        var propertyFilters = FX.U.clone(filters);
        delete propertyFilters.animation;
        if (
            !FX.Filters.effect(
                {
                    effectName: record.effectName,
                    matchName: record.matchName,
                    enabled: out.enabled,
                    configuration: configuration
                },
                propertyFilters
            )
        ) {
            return null;
        }
    }
    out.configuration = this.capture(target.effect);
    var fingerprintStarted = FX.U.now();
    out.fingerprint = FX.Config.fingerprint(out.configuration);
    this.diagnostics.measure('fingerprint', FX.U.now() - fingerprintStarted, 1);
    out.analysisState = 'analyzed';
    return out;
};
// Explicit inspection only: existing occurrence, selected paths, no effect creation.
FX.AfterEffectsAdapter.prototype.inspectAnimation = function (
    record,
    paths,
    layerRecord
) {
    FX.U.assert(
        paths && paths.length > 0 && paths.length <= 64,
        'Select 1 to 64 property paths.'
    );
    FX.U.assert(
        layerRecord &&
            FX.Model.layerKey(record) === FX.Model.layerKey(layerRecord),
        'Missing structural snapshot.'
    );
    this.validateLayer(layerRecord, true);
    var effect = this.resolve(record).effect,
        self = this,
        out = [],
        i;
    function interpolation(v) {
        if (typeof KeyframeInterpolationType !== 'undefined') {
            if (v === KeyframeInterpolationType.LINEAR) {
                return 'LINEAR';
            }
            if (v === KeyframeInterpolationType.HOLD) {
                return 'HOLD';
            }
            if (v === KeyframeInterpolationType.BEZIER) {
                return 'BEZIER';
            }
        }
        throw new Error('interpolation-unavailable');
    }
    function ease(v) {
        var result = [],
            j;
        FX.U.assert(v && v.length > 0, 'ease-unavailable');
        for (j = 0; j < v.length; j++) {
            FX.U.assert(
                typeof v[j].speed === 'number' &&
                    isFinite(v[j].speed) &&
                    typeof v[j].influence === 'number' &&
                    isFinite(v[j].influence),
                'ease-invalid'
            );
            result.push({ speed: v[j].speed, influence: v[j].influence });
        }
        return result;
    }
    for (i = 0; i < paths.length; i++) {
        var p,
            t = 'unknown',
            result = {
                path: paths[i],
                valueType: t,
                complete: true,
                reasons: [],
                data: { keys: [] }
            },
            count,
            k;
        function failure(field) {
            result.complete = false;
            result.reasons.push(field + ': unavailable');
            self.diagnostics.add(
                'animation-inspection',
                record.matchName,
                field + '-unavailable'
            );
            return null;
        }
        function field(name, fn) {
            try {
                return fn();
            } catch (readError) {
                return failure(name);
            }
        }
        function keyField(name, index, convert) {
            return field(name, function () {
                FX.U.assert(p[name], 'API unavailable');
                var v = p[name](index);
                return convert ? convert(v) : v;
            });
        }
        function numeric(v) {
            FX.U.assert(
                typeof v === 'number' && isFinite(v),
                'number unavailable'
            );
            return v;
        }
        function flag(v) {
            FX.U.assert(typeof v === 'boolean', 'flag unavailable');
            return v;
        }
        function vector(v) {
            FX.U.assert(v && v.length, 'vector unavailable');
            var a = [],
                j;
            for (j = 0; j < v.length; j++) {
                a.push(numeric(v[j]));
            }
            return a;
        }
        try {
            p = this.resolveProperty(effect, paths[i]);
            FX.U.assert(
                p && p.propertyType === PropertyType.PROPERTY,
                'Property unavailable'
            );
            t = this.valueType(p);
            result.valueType = t;
            FX.U.assert(
                FX.U.contains(
                    [
                        'OneD',
                        'TwoD',
                        'ThreeD',
                        'TwoD_SPATIAL',
                        'ThreeD_SPATIAL',
                        'COLOR'
                    ],
                    t
                ),
                'Unsupported type'
            );
            count = p.numKeys;
            FX.U.assert(
                typeof count === 'number' &&
                    isFinite(count) &&
                    count >= 0 &&
                    count === Math.floor(count),
                'Unknown key count'
            );
            result.data.keyCount = count;
            result.data.expression = field('expression', function () {
                return p.canSetExpression ? String(p.expression || '') : '';
            });
            result.data.expressionEnabled = false;
            if (result.data.expression) {
                result.data.expressionEnabled = field(
                    'expressionEnabled',
                    function () {
                        return flag(p.expressionEnabled);
                    }
                );
            }
            result.data.state = 'Static';
            if (count > 0) {
                result.data.state = 'Keyframed';
            }
            if (result.data.expression) {
                result.data.state = count > 0 ? 'Mixed' : 'Expression-driven';
            }
            if (count > 2000) {
                failure('key-limit-2000');
            }
            if (count === 0 && result.data.state === 'Static') {
                result.data.value = field('value', function () {
                    var v = p.value;
                    FX.Validate.value(t, v);
                    return FX.U.clone(v);
                });
            }
            for (k = 1; k <= count && k <= 2000; k++) {
                var key = { index: k };
                key.time = keyField('keyTime', k, numeric);
                key.value = keyField('keyValue', k, function (v) {
                    FX.Validate.value(t, v);
                    return FX.U.clone(v);
                });
                key.inInterpolation = keyField(
                    'keyInInterpolationType',
                    k,
                    interpolation
                );
                key.outInterpolation = keyField(
                    'keyOutInterpolationType',
                    k,
                    interpolation
                );
                key.inEase = keyField('keyInTemporalEase', k, ease);
                key.outEase = keyField('keyOutTemporalEase', k, ease);
                key.temporalAutoBezier = keyField(
                    'keyTemporalAutoBezier',
                    k,
                    flag
                );
                key.temporalContinuous = keyField(
                    'keyTemporalContinuous',
                    k,
                    flag
                );
                if (t === 'TwoD_SPATIAL' || t === 'ThreeD_SPATIAL') {
                    key.inSpatialTangent = keyField(
                        'keyInSpatialTangent',
                        k,
                        vector
                    );
                    key.outSpatialTangent = keyField(
                        'keyOutSpatialTangent',
                        k,
                        vector
                    );
                    key.spatialAutoBezier = keyField(
                        'keySpatialAutoBezier',
                        k,
                        flag
                    );
                    key.spatialContinuous = keyField(
                        'keySpatialContinuous',
                        k,
                        flag
                    );
                    key.roving = keyField('keyRoving', k, flag);
                }
                key.curve = FX.Animation.curve(key);
                result.data.keys.push(key);
            }
            if (result.data.expression === null) {
                result.data.state = 'Unsupported';
            }
        } catch (propertyError) {
            failure('property');
            result.data.state = 'Unsupported';
        }
        out.push(result);
    }
    return out;
};
FX.AfterEffectsAdapter.prototype._validateOccurrence = function (
    record,
    layerRecord
) {
    var target = this.resolve(record),
        observed;
    if (record.configuration && record.fingerprint) {
        observed = FX.Config.fingerprint(this.capture(target.effect));
        FX.U.assert(
            observed.canonical === record.fingerprint.canonical,
            'Configuration changed since scan; Refresh.'
        );
    } else {
        var stack = FX.JSON.parse(layerRecord.stackSignature),
            matches = 0,
            i;
        for (i = 0; i < stack.length; i++) {
            if (
                stack[i].name === record.effectName &&
                stack[i].matchName === record.matchName
            ) {
                matches++;
            }
        }
        FX.U.assert(
            matches === 1,
            'Repeated effect identifiers require Configuration Analysis before mutation.'
        );
        FX.U.assert(
            record.enabled !== null &&
                !!target.effect.enabled === record.enabled,
            'Effect state changed since scan; Refresh.'
        );
    }
    return target;
};
// Retain conservative full comparison: AE exposes no reliable per-effect revision token.
FX.AfterEffectsAdapter.prototype.capture = function (effect, paths) {
    var started = FX.U.now();
    try {
        return this._capture(effect, paths);
    } finally {
        FX.U.measure(this.diagnostics, 'capture', started, 1);
    }
};
FX.AfterEffectsAdapter.prototype.validateOccurrence = function (
    record,
    layerRecord
) {
    var started = FX.U.now();
    try {
        return this._validateOccurrence(record, layerRecord);
    } finally {
        FX.U.measure(this.diagnostics, 'validateOccurrence', started, 1);
    }
};
FX.AfterEffectsAdapter.prototype.validateKeyframeRemoval = function (effect, authorizations) {
    var i, p, authorization,
        profile = authorizations.length ? this.parameterProfile(effect) : null;
    for (i = 0; i < authorizations.length; i++) {
        authorization = authorizations[i];
        FX.U.assert(!this.parameterBlock(effect, authorization.path, authorization.valueType, profile),
            'Internal/system parameters cannot have their keyframes removed');
        p = this.resolveProperty(effect, authorization.path);
        var currentControl = this.parameterControl(effect, p, authorization.path, profile, authorization.valueType);
        FX.U.assert(!currentControl || currentControl.kind !== 'unavailable-menu', 'Dropdown options are unavailable; animation preserved');
        FX.U.assert(p.propertyType === PropertyType.PROPERTY && this.valueType(p) === authorization.valueType,
            'Keyframed property type changed; read parameters again');
        FX.U.assert(typeof authorization.keyCount === 'number' && authorization.keyCount > 0 &&
            isFinite(authorization.keyCount) &&
            authorization.keyCount === Math.floor(authorization.keyCount) &&
            p.numKeys === authorization.keyCount,
            'Keyframe count changed; read parameters again');
        FX.U.assert(!p.canSetExpression || String(p.expression || '').length === 0,
            'Expression property preserved; read parameters again');
        FX.U.assert(typeof p.removeKey === 'function' && typeof p.setValue === 'function',
            'Keyframe removal is unavailable for this property');
        if (FX.U.own(authorization, 'currentValue')) {
            FX.U.assert(FX.JSON.stringify(p.value) === FX.JSON.stringify(authorization.currentValue),
                'Current value changed; read parameters again before clearing keyframes');
        }
    }
};
// The editor requires every requested parameter on every selected occurrence.
// Validate the complete batch before the first setter or key removal.
FX.AfterEffectsAdapter.prototype.validateEditRows = function (effect, rows, authorizations) {
    var i, j, p, row, allowed, control, profile = this.parameterProfile(effect);
    for (i = 0; i < rows.length; i++) {
        row = rows[i];
        FX.U.assert(!this.parameterBlock(effect, row.path, row.valueType, profile), 'Protected parameter');
        p = this.resolveProperty(effect, row.path);
        FX.U.assert(p.propertyType === PropertyType.PROPERTY && this.valueType(p) === row.valueType,
            'Parameter unavailable or incompatible; no selected effects were changed');
        allowed = false;
        for (j = 0; j < authorizations.length; j++) {
            if (FX.Config.key(authorizations[j].path) === FX.Config.key(row.path)) { allowed = true; }
        }
        FX.U.assert(p.numKeys === 0 || allowed, 'Authorize keyframe removal for all selected effects');
        FX.U.assert(!p.canSetExpression || !String(p.expression || '').length, 'Expression property protected');
        FX.U.assert(typeof p.setValue === 'function', 'Parameter cannot be written');
        control = this.parameterControl(effect, p, row.path, profile, row.valueType);
        FX.Validate.rows([{ path: row.path, valueType: row.valueType, value: row.value, control: control }]);
        FX.U.assert(!control || control.kind !== 'unavailable-menu', 'Dropdown options unavailable');
        if (row.control && row.control.kind === 'menu') {
            FX.U.assert(control && control.kind === 'menu' &&
                FX.JSON.stringify(control.choices) === FX.JSON.stringify(row.control.choices), 'Dropdown options changed');
        }
    }
};
FX.AfterEffectsAdapter.prototype.writeRows = function (effect, rows, options) {
    options = options || {};
    var r = {
            failedBeforeWrite: 0,
            written: 0,
            verified: 0,
            verificationFailed: 0,
            unknown: 0,
            skipped: 0,
            failed: 0,
            keyframesRemoved: 0,
            animationMutationAttempted: false,
            reasons: [],
            outcomes: []
        },
        i,
        p,
        row,
        phase,
        started,
        item,
        requested,
        observed,
        authorizations = options.keyframes || [],
        authorization,
        a,
        keyIndex,
        parameterProfile = this.parameterProfile(effect),
        blockedReason,
        liveControl;
    FX.Validate.rows(rows);
    for (i = 0; i < rows.length; i++) {
        row = rows[i];
        phase = 'prepare';
        authorization = null;
        for (a = 0; a < authorizations.length; a++) {
            if (FX.Config.key(authorizations[a].path) === FX.Config.key(row.path)) {
                authorization = authorizations[a];
            }
        }
        item = { path: FX.U.clone(row.path), status: 'Failed Before Write', keyframesRemoved: 0 };
        r.outcomes.push(item);
        try {
            blockedReason = this.parameterBlock(effect, row.path, row.valueType, parameterProfile);
            if (blockedReason) {
                item.status = 'Skipped';
                item.reason = 'Protected parameter: ' + blockedReason;
                r.skipped++;
                r.reasons.push(item.reason);
                continue;
            }
            p = this.resolveProperty(effect, row.path);
            if (
                p.propertyType !== PropertyType.PROPERTY ||
                this.valueType(p) !== row.valueType
            ) {
                item.status = 'Skipped';
                item.reason = 'Unsupported property';
            } else {
                var keys = p.numKeys;
                if (
                    typeof keys !== 'number' ||
                    !isFinite(keys) ||
                    keys < 0 ||
                    keys !== Math.floor(keys)
                ) {
                    item.status = 'Skipped';
                    item.reason = 'Unknown animation state preserved';
                } else if (
                    (keys > 0 && !authorization) ||
                    (p.canSetExpression &&
                        String(p.expression || '').length > 0)
                ) {
                    item.status = 'Skipped';
                    item.reason = 'Animated/expression property preserved';
                }
            }
            if (item.status === 'Skipped') {
                r.skipped++;
                r.reasons.push(item.reason);
                continue;
            }
            FX.Validate.value(row.valueType, row.value);
            liveControl = this.parameterControl(effect, p, row.path, parameterProfile, row.valueType);
            FX.U.assert(!liveControl || liveControl.kind !== 'unavailable-menu', 'Dropdown options are unavailable; parameter preserved');
            if (liveControl && liveControl.kind === 'menu') {
                FX.U.assert(FX.Parameters.menuValue(liveControl, row.value) !== null, 'Invalid dropdown choice');
            }
            if (row.control && row.control.kind === 'menu') {
                FX.U.assert(liveControl && liveControl.kind === 'menu' &&
                    FX.JSON.stringify(liveControl.choices) === FX.JSON.stringify(row.control.choices),
                    'Dropdown options changed; read parameters again');
            }
            if (row.valueType === 'OneD') {
                FX.U.assert(
                    !p.hasMin || row.value >= p.minValue,
                    'Value below minimum'
                );
                FX.U.assert(
                    !p.hasMax || row.value <= p.maxValue,
                    'Value above maximum'
                );
            }
            requested = FX.U.clone(row.value);
            if (authorization) {
                this.validateKeyframeRemoval(effect, [authorization]);
                // Removing descending indices keeps remaining keys addressable.
                for (keyIndex = authorization.keyCount; keyIndex >= 1; keyIndex--) {
                    phase = 'remove-keys';
                    r.animationMutationAttempted = true;
                    p.removeKey(keyIndex);
                    r.keyframesRemoved++;
                    item.keyframesRemoved++;
                    FX.U.assert(p.numKeys === keyIndex - 1, 'Keyframe removal could not be verified');
                }
            }
            phase = 'write';
            started = FX.U.now();
            try {
                p.setValue(requested);
            } finally {
                FX.U.measure(this.diagnostics, 'setValue', started, 1);
            }
            // A returned setValue is a write even when the following read fails.
            r.written++;
            phase = 'readback';
            started = FX.U.now();
            try {
                observed = p.value;
                FX.Validate.value(row.valueType, observed);
                if (authorization) {
                    FX.U.assert(p.numKeys === 0, 'Keyframes remain after conversion to a fixed value');
                }
                // Float storage noise (e.g. float32 colors) is accepted;
                // real rounding or clamping still fails verification.
                FX.U.assert(
                    FX.U.sameValue(observed, row.value),
                    'Host normalized, rounded or did not retain requested value'
                );
            } finally {
                FX.U.measure(this.diagnostics, 'readback', started, 1);
            }
            item.status = 'Written and Verified';
            if (FX.JSON.stringify(observed) !== FX.JSON.stringify(row.value)) {
                item.reason = 'Host stored the value at its own precision: ' +
                    FX.JSON.stringify(observed);
            }
            r.verified++;
        } catch (error) {
            r.failed++;
            if (phase === 'write' || phase === 'remove-keys') {
                item.status = 'Unknown After Host Error';
                r.unknown++;
            } else if (phase === 'readback') {
                item.status = 'Written but Verification Failed';
                r.verificationFailed++;
            }
            if (phase === 'prepare') {
                r.failedBeforeWrite++;
            }
            item.reason = FX.U.errorText(error, 'write-property/' + phase);
            r.reasons.push(item.reason);
            this.diagnostics.error('write-property/' + phase, error);
            if (authorization && (phase === 'remove-keys' || phase === 'write')) {
                for (a = i + 1; a < rows.length; a++) {
                    r.skipped++;
                    r.outcomes.push({ path: FX.U.clone(rows[a].path), status: 'Skipped', reason: 'Stopped after uncertain animation mutation' });
                }
                break;
            }
        }
    }
    return r;
};
FX.AfterEffectsAdapter.prototype.addEffect = function (
    record,
    matchName,
    beforeWrite
) {
    var t = this.resolveLayer(record),
        p = t.layer.property('ADBE Effect Parade');
    FX.U.assert(!t.layer.locked, 'Layer is locked');
    FX.U.assert(
        p && p.canAddProperty(matchName),
        'Effect unavailable or incompatible with layer'
    );
    if (beforeWrite) {
        beforeWrite();
    }
    var index = p.addProperty(matchName).propertyIndex;
    return t.layer.property('ADBE Effect Parade').property(index);
};
FX.AfterEffectsAdapter.prototype.selectLayers = function (records) {
    FX.U.assert(records.length, 'Select results first');
    var compId = records[0].compId,
        t = this.resolveLayer(records[0]),
        i;
    t.comp.openInViewer();
    for (i = 1; i <= t.comp.numLayers; i++) {
        t.comp.layer(i).selected = false;
    }
    for (i = 0; i < records.length; i++) {
        if (records[i].compId === compId) {
            this.resolveLayer(records[i]).layer.selected = true;
        }
    }
};
FX.AfterEffectsAdapter.prototype.locate = function (record) {
    this.selectLayers([record]);
    if (record.effectIndex) {
        try {
            this.resolve(record).effect.selected = true;
        } catch (e) {
            this.diagnostics.add(
                'locate',
                record.matchName,
                FX.U.errorText(e, 'ae')
            );
        }
    }
};
FX.AfterEffectsAdapter.prototype.schedule = function (callbackName, epoch) {
    var argument = '';
    if (typeof epoch === 'number') {
        argument = String(epoch);
    }
    var code =
        'if (typeof ' +
        callbackName +
        ' === \"function\") { ' +
        callbackName +
        '(' +
        argument +
        '); }';
    var id = app.scheduleTask(code, 10, false);
    this.diagnostics.measure('tasksScheduled', 0, 1);
    return id;
};
FX.AfterEffectsAdapter.prototype.cancelTask = function (id) {
    if (id !== null) {
        app.cancelTask(id);
        this.diagnostics.measure('tasksCancelled', 0, 1);
    }
};
