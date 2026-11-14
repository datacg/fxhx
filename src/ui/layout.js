// Manual row geometry for the dockable panel. ScriptUI's automatic layout
// cannot wrap or scroll a docked panel, so rows are positioned explicitly.
FX.Layout = (function () {
    // Width from the host font (scales with UI zoom/DPI); the fixed
    // fallback keeps the previous geometry when measuring is unavailable.
    function textWidth(c) {
        var label = c.type === 'statictext',
            fallback = label ? 38 : 64,
            measured;
        try {
            measured = c.graphics.measureString(String(c.text))[0];
            if (typeof measured === 'number' && isFinite(measured) && measured > 0) {
                return Math.max(fallback, Math.ceil(measured) + (label ? 6 : 22));
            }
        } catch (ignoredMeasure) {}
        return fallback;
    }
    function row(control, width, height, primaryFirst) {
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
        if (primaryFirst) {
            weights[0] = 2;
        }
        if (flex >= 0) {
            for (i = 0; i < items.length; i++) {
                if (i === flex) {
                    continue;
                }
                widths[i] = textWidth(items[i]);
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
    return { textWidth: textWidth, row: row };
})();
