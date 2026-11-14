// Shared ScriptUI value input used by the parameter editor and the preset
// editor. It owns no host objects: callers pass the row metadata and read
// back texts/menu choices. Parsing accepts decimal commas (20,5).
FX.ValueInput = (function () {
    var LABELS = {
        OneD: [''],
        TwoD: ['X', 'Y'],
        TwoD_SPATIAL: ['X', 'Y'],
        ThreeD: ['X', 'Y', 'Z'],
        ThreeD_SPATIAL: ['X', 'Y', 'Z'],
        COLOR: ['R', 'G', 'B', 'A']
    };
    function dimension(valueType) {
        if (valueType === 'OneD') { return 1; }
        if (valueType === 'COLOR') { return 4; }
        if (valueType === 'TwoD' || valueType === 'TwoD_SPATIAL') { return 2; }
        return 3;
    }
    function labels(valueType) {
        return LABELS[valueType] || ['X', 'Y', 'Z'];
    }
    function isMenu(row) {
        return !!(row && row.control && row.control.kind === 'menu');
    }
    // texts: one string per component. Returns a number or an array.
    function parse(row, texts) {
        var size = dimension(row.valueType), names = labels(row.valueType), values = [], n, label;
        for (n = 0; n < size; n++) {
            label = row.name || 'Value';
            if (size > 1) { label += ' ' + names[n]; }
            FX.U.assert(/\S/.test(texts[n] || ''), 'Enter every component for ' + (row.name || 'this parameter'));
            values.push(FX.U.parseNumber(texts[n], label));
        }
        return size === 1 ? values[0] : values;
    }
    function format(n) {
        // Short, locale-neutral display for prefilled fields.
        return String(Math.round(n * 10000) / 10000);
    }
    function texts(value) {
        var out = [], i;
        if (FX.U.array(value)) {
            for (i = 0; i < value.length; i++) { out.push(format(value[i])); }
        } else if (typeof value === 'number') {
            out.push(format(value));
        }
        return out;
    }
    function hexToColor(text) {
        var s = FX.U.trim(text).replace(/^#/, ''), n;
        FX.U.assert(/^[0-9a-fA-F]{6}$/.test(s), 'Use a hex color such as #FF8800');
        n = parseInt(s, 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    function colorToHex(rgb) {
        var out = '#', i, c;
        for (i = 0; i < 3; i++) {
            c = Math.max(0, Math.min(255, Math.round(Number(rgb[i]) * 255)));
            out += (c < 16 ? '0' : '') + c.toString(16).toUpperCase();
        }
        return out;
    }
    function create(parent, o) {
        o = o || {};
        var host = parent.add('group'), i, current = null, enabled = true, notify = null, syncing = false;
        host.orientation = 'stack';
        host.alignment = ['fill', 'center'];
        host.alignChildren = ['fill', 'center'];
        host.minimumSize.height = 24;
        var numbers = host.add('group');
        numbers.orientation = 'row';
        numbers.spacing = 4;
        numbers.alignChildren = ['left', 'center'];
        var fields = [], names = [];
        for (i = 0; i < 4; i++) {
            names.push(numbers.add('statictext', undefined, FX.I18N.t('X')));
            names[i].minimumSize.width = 10;
            fields.push(numbers.add('edittext', undefined, ''));
            fields[i].characters = 7;
            fields[i].minimumSize = [56, 24];
            if (o.fieldFlag) { fields[i][o.fieldFlag] = true; }
        }
        var hex = numbers.add('edittext', undefined, '');
        hex.characters = 8;
        hex.helpTip = 'Hex color, e.g. #FF8800. Fills R, G and B (0-1).';
        hex.fxHexInput = true;
        var pick = numbers.add('button', undefined, FX.I18N.t('Pick...'));
        pick.fxTitle = 'Pick...';
        pick.helpTip = 'Open the system color picker.';
        pick.preferredSize.width = 52;
        // Way back from Number... for parameters detected as on/off.
        var asCheckbox = numbers.add('button', undefined, FX.I18N.t('Checkbox'));
        asCheckbox.fxTitle = 'Checkbox';
        asCheckbox.helpTip = 'Edit this parameter with an on/off checkbox again.';
        var menu = host.add('dropdownlist', undefined, FX.I18N.list([]));
        menu.minimumSize = [180, 24];
        menu.preferredSize.width = 230;
        if (o.menuFlag) { menu[o.menuFlag] = true; }
        // On/off parameters: a checkbox that writes "1"/"0" into the first
        // (hidden) number field, so drafts, parsing and writes stay numeric.
        var toggleGroup = host.add('group');
        toggleGroup.orientation = 'row';
        toggleGroup.alignChildren = ['left', 'center'];
        toggleGroup.spacing = 8;
        var toggle = toggleGroup.add('checkbox', undefined, FX.I18N.t('On'));
        toggle.fxToggleInput = true;
        var toggleState = toggleGroup.add('statictext', undefined, '');
        toggleState.preferredSize.width = 170;
        var asNumber = toggleGroup.add('button', undefined, FX.I18N.t('Number...'));
        asNumber.fxTitle = 'Number...';
        asNumber.helpTip = 'Edit this parameter as a number instead of on/off.';
        var numericOverride = {}, lastValues = null, lastMenu = null, currentHint = null;
        function toggleMode() {
            return !!current && !!current.toggle && !numericOverride['$' + FX.Config.key(current.path || [])];
        }
        function describeToggle() {
            var draft = fields[0].text;
            if (draft === '1' || draft === '0') {
                toggleState.text = FX.I18N.t(draft === '1' ? 'Will set: On' : 'Will set: Off');
            } else if (currentHint === 1 || currentHint === 0) {
                toggleState.text = FX.I18N.t(currentHint === 1 ? 'Unchanged (now On)' : 'Unchanged (now Off)');
            } else {
                toggleState.text = FX.I18N.t('Unchanged (mixed)');
            }
        }
        toggle.onClick = function () {
            if (syncing) { return; }
            fields[0].text = toggle.value ? '1' : '0';
            describeToggle();
            changed();
        };
        asNumber.onClick = function () {
            if (!current) { return; }
            numericOverride['$' + FX.Config.key(current.path || [])] = true;
            setRow(current, readTexts(), lastMenu, { current: currentHint });
            changed();
        };
        asCheckbox.onClick = function () {
            if (!current) { return; }
            delete numericOverride['$' + FX.Config.key(current.path || [])];
            // Only 0/1 can be shown by the checkbox; other numbers are dropped.
            var texts = readTexts();
            if (texts[0] !== '0' && texts[0] !== '1') { texts = ['']; }
            setRow(current, texts, lastMenu, { current: currentHint });
            changed();
        };
        function changed() {
            if (!syncing && notify) { notify(); }
        }
        function isColor() { return !!current && current.valueType === 'COLOR'; }
        function syncHex() {
            if (!isColor()) { return; }
            try {
                hex.text = colorToHex([FX.U.parseNumber(fields[0].text), FX.U.parseNumber(fields[1].text),
                    FX.U.parseNumber(fields[2].text)]);
            } catch (ignoredIncomplete) {
                hex.text = '';
            }
        }
        function setColor(rgb) {
            syncing = true;
            try {
                for (var c = 0; c < 3; c++) { fields[c].text = format(rgb[c]); }
                if (!/\S/.test(fields[3].text)) { fields[3].text = '1'; }
                hex.text = colorToHex(rgb);
            } finally { syncing = false; }
            changed();
        }
        hex.onChange = function () {
            if (syncing || !isColor() || !/\S/.test(hex.text)) { return; }
            try {
                setColor(hexToColor(hex.text));
            } catch (badHex) {
                if (o.onError) { o.onError(badHex); }
            }
        };
        pick.onClick = function () {
            if (typeof $ === 'undefined' || typeof $.colorPicker !== 'function') {
                if (o.onError) { o.onError(new Error('Color picker unavailable; type values or a hex color.')); }
                return;
            }
            var initial = -1, picked;
            try {
                var rgb = hexToColor(hex.text);
                initial = (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255);
            } catch (ignoredStart) {}
            picked = $.colorPicker(initial);
            if (typeof picked === 'number' && picked >= 0) {
                setColor([((picked >> 16) & 255) / 255, ((picked >> 8) & 255) / 255, (picked & 255) / 255]);
            }
        };
        for (i = 0; i < fields.length; i++) {
            fields[i].onChanging = fields[i].onChange = function () {
                syncHex();
                changed();
            };
        }
        menu.onChange = changed;
        // info.current: the shared current value when all targets agree.
        function setRow(row, values, menuValue, info) {
            var size, n, c, item, rowLabels, asToggle;
            current = row || null;
            lastValues = values;
            lastMenu = menuValue;
            currentHint = info && typeof info.current === 'number' ? info.current : null;
            syncing = true;
            try {
                menu.removeAll();
                menu.add('item', FX.I18N.t(o.keepLabel || 'Keep original values'));
                menu.selection = 0;
                if (isMenu(row)) {
                    for (n = 0; n < row.control.choices.length; n++) {
                        c = row.control.choices[n];
                        item = menu.add('item', c.label);
                        item.fxValue = c.value;
                        if (menuValue === c.value) { menu.selection = item; }
                    }
                }
                size = row ? dimension(row.valueType) : 0;
                rowLabels = row ? labels(row.valueType) : [];
                menu.visible = isMenu(row);
                numbers.visible = !!row && !isMenu(row) && size > 0;
                for (n = 0; n < fields.length; n++) {
                    fields[n].visible = !isMenu(row) && n < size;
                    names[n].visible = fields[n].visible && size > 1;
                    names[n].text = rowLabels[n] || '';
                    fields[n].text = values && values[n] !== undefined ? values[n] : '';
                }
                hex.visible = pick.visible = !!row && row.valueType === 'COLOR' && !isMenu(row);
                hex.text = '';
                syncHex();
                asToggle = toggleMode();
                toggleGroup.visible = asToggle;
                asCheckbox.visible = !!row && !!row.toggle && !asToggle;
                if (asToggle) {
                    numbers.visible = false;
                    if (fields[0].text === '1' || fields[0].text === '0') {
                        toggle.value = fields[0].text === '1';
                    } else {
                        fields[0].text = '';
                        toggle.value = currentHint === 1;
                    }
                    describeToggle();
                }
                setEnabled(enabled);
            } finally { syncing = false; }
        }
        function setEnabled(flag) {
            enabled = !!flag;
            menu.enabled = enabled;
            hex.enabled = pick.enabled = enabled;
            toggle.enabled = asNumber.enabled = asCheckbox.enabled = enabled;
            for (var n = 0; n < fields.length; n++) { fields[n].enabled = enabled; }
        }
        function readTexts() {
            var out = [], n, size = current ? dimension(current.valueType) : 0;
            for (n = 0; n < size; n++) { out.push(fields[n].text); }
            return out;
        }
        function hasText() {
            var t = readTexts(), n;
            for (n = 0; n < t.length; n++) { if (/\S/.test(t[n])) { return true; } }
            return false;
        }
        function menuChoice() {
            var v = menu.selection ? menu.selection.fxValue : null;
            return typeof v === 'number' ? v : null;
        }
        function value() {
            FX.U.assert(current, 'Choose a parameter');
            if (isMenu(current)) {
                var v = menuChoice();
                FX.U.assert(v !== null, 'Choose a dropdown option');
                return v;
            }
            return parse(current, readTexts());
        }
        return {
            host: host, fields: fields, labels: names, menu: menu, hex: hex, pick: pick,
            toggle: toggle, toggleState: toggleState, asNumber: asNumber,
            isToggle: toggleMode,
            setRow: setRow, setEnabled: setEnabled, texts: readTexts, hasText: hasText,
            menuChoice: menuChoice, value: value,
            onChange: function (fn) { notify = fn; }
        };
    }
    return {
        create: create, parse: parse, texts: texts, dimension: dimension, labels: labels,
        hexToColor: hexToColor, colorToHex: colorToHex, isMenu: isMenu
    };
})();
