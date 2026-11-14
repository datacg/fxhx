// Eligibility is separate from numeric serialization. Host compositing controls
// and plugin bookkeeping are not user-facing effect adjustments.
FX.Parameters = (function () {
    function normalize(name) {
        return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    function profile(matchName, names) {
        var id = normalize(matchName), seen = {}, i;
        if (/^(?:(?:com)?(?:bskl|baskl))?aicolormatch(?:pro)?$/.test(id)) {
            return 'ai-color-match';
        }
        if (/^(?:pe|plugineverything)?deepglow2$/.test(id)) {
            return 'deep-glow-2';
        }
        // Version-independent fallback for the schema documented by the user.
        // Never identify an effect from its mutable instance display name.
        for (i = 0; names && i < names.length; i++) {
            seen['$' + normalize(names[i])] = true;
        }
        if (seen.$connectiontimestamp && seen.$colorstyleimage &&
            seen.$intensity && (seen.$stylereferenceimages || seen.$matchatplayhead)) {
            return 'ai-color-match';
        }
        if (seen.$glowmode && seen.$blendmode && seen.$thresholdsmooth && seen.$saturationbias) {
            return 'deep-glow-2';
        }
        return null;
    }
    function fromConfig(config) {
        if (!config) {
            return null;
        }
        if (config.parameterProfile) {
            return config.parameterProfile;
        }
        var names = [], i, sources = [config.properties || [], config.states || []], j;
        for (i = 0; i < sources.length; i++) {
            for (j = 0; j < sources[i].length; j++) {
                names.push(sources[i][j].name || '');
            }
        }
        return profile(config.effectMatchName, names);
    }
    function blocked(profileName, path, name, valueType) {
        var i, id, label = normalize(name);
        for (i = 0; path && i < path.length; i++) {
            id = path[i].matchName;
            if (id === 'ADBE Effect Built In Params' ||
                id === 'ADBE Effect Mask Opacity' ||
                id === 'ADBE Force CPU GPU' ||
                id === 'ADBE Effect Mask Parade') {
                return 'host-system-parameter';
            }
            id = normalize(id);
            if (id === 'connectiontimestamp' || id === 'gpurendering' || id === 'effectopacity' || id === 'debuganalysisenable') {
                return 'internal-parameter';
            }
        }
        if (label === 'connectiontimestamp' || label === 'gpurendering' || label === 'effectopacity' || label === 'debuganalysisenable') {
            return 'internal-parameter';
        }
        if (profileName === 'ai-color-match') {
            // The public numeric adjustment verified in the supplied UI is
            // Intensity. Buttons, reference inputs and private fields are not
            // candidates for generic numeric editing.
            if (label !== 'intensity' || path.length !== 1) {
                return 'not-public-parameter';
            }
            if (valueType && valueType !== 'OneD') {
                return 'profile-type-mismatch';
            }
        }
        return null;
    }
    function excluded(reason) {
        return reason === 'host-system-parameter' || reason === 'internal-parameter' ||
            reason === 'not-public-parameter' || reason === 'profile-type-mismatch';
    }
    function rows(matchName, rows) {
        var kept = [], i, current = profile(matchName, []);
        for (i = 0; i < rows.length; i++) {
            if (!blocked(current, rows[i].path, rows[i].name, rows[i].valueType)) {
                kept.push(rows[i]);
            }
        }
        return kept;
    }
    function choices(items) {
        var out = [], i, label;
        if (!FX.U.array(items) || items.length < 1 || items.length > 2048) {
            return null;
        }
        for (i = 0; i < items.length; i++) {
            label = items[i];
            if (typeof label !== 'string' || !label.length || label.length > 512) {
                return null;
            }
            if (label !== '(-') {
                out.push({ value: i + 1, label: label });
            }
        }
        return out.length ? out : null;
    }
    function menuValue(control, value) {
        var i;
        for (i = 0; control && control.choices && i < control.choices.length; i++) {
            if (control.choices[i].value === value) {
                return control.choices[i].label;
            }
        }
        return null;
    }
    // ExtendScript has no checkbox flag. A parameter is presented as on/off
    // only with strong evidence: the Checkbox Control expression effect, or a
    // plain OneD number without units, a range of 0..1 (or none), and every
    // known current value exactly 0 or 1. The editor keeps a "Number..."
    // escape for the rare slider that happens to sit at 0 or 1.
    function isToggle(row, values, effectMatchName) {
        var c, i;
        if (!row || row.valueType !== 'OneD') {
            return false;
        }
        c = row.control;
        if (c && c.kind !== 'number') {
            return false;
        }
        if (c && (c.units || (c.min !== undefined && c.min !== 0) || (c.max !== undefined && c.max !== 1))) {
            return false;
        }
        if (effectMatchName === 'ADBE Checkbox Control') {
            return true;
        }
        if (!values || !values.length) {
            return false;
        }
        for (i = 0; i < values.length; i++) {
            if (values[i] !== 0 && values[i] !== 1) {
                return false;
            }
        }
        return true;
    }
    function display(row, value) {
        if (typeof value === 'undefined') {
            value = row.value;
        }
        var label;
        if (row && row.toggle && (value === 0 || value === 1)) {
            label = value === 1 ? 'On' : 'Off';
            return FX.I18N ? FX.I18N.t(label) : label;
        }
        label = menuValue(row.control, value);
        if (label !== null) {
            return label;
        }
        return FX.U.array(value) ? value.join(', ') : String(value);
    }
    return { profile: profile, fromConfig: fromConfig, blocked: blocked, excluded: excluded,
        rows: rows, choices: choices, menuValue: menuValue, display: display, normalize: normalize,
        isToggle: isToggle };
})();
