// Hierarchical results backed by a native multiselect ListBox. TreeView can
// highlight only one item; work selection must remain visible on every row.
FX.Results = function (parent) {
    var control = parent.add('listbox', undefined, [], { multiselect: true }),
        tree = { control: control, items: [], selection: null },
        visible = [],
        syncing = false,
        keyboardTarget = null,
        ctrlGesture = false,
        shiftGesture = false,
        pendingClick = false;
    function add(owner, type, title) {
        var node = {
            text: title,
            type: type,
            items: [],
            expanded: false,
            add: function (kind, label) {
                return add(node, kind, label);
            }
        };
        owner.items.push(node);
        return node;
    }
    tree.add = function (type, title) {
        return add(tree, type, title);
    };
    tree.removeAll = function () {
        syncing = true;
        try {
            control.removeAll();
            tree.items = [];
            tree.selection = null;
            tree.anchor = null;
            visible = [];
            keyboardTarget = null;
        } finally {
            syncing = false;
        }
    };
    tree.refresh = function () {
        var next = [], i, n, label, indent, j, changed = false;
        function walk(owner) {
            var k, child;
            for (k = 0; k < owner.items.length; k++) {
                child = owner.items[k];
                next.push(child);
                if (child.expanded) {
                    walk(child);
                }
            }
        }
        walk(tree);
        changed = next.length !== visible.length;
        for (i = 0; !changed && i < next.length; i++) {
            changed = next[i] !== visible[i];
        }
        syncing = true;
        try {
            if (changed) {
                control.removeAll();
                visible = next;
            }
            for (i = 0; i < visible.length; i++) {
                n = visible[i];
                indent = '';
                for (j = 0; j < n.fxDepth; j++) {
                    indent += '    ';
                }
                label = '  ';
                if (n.type === 'node') {
                    label = n.expanded ? 'v ' : '> ';
                }
                label = indent + label + n.text;
                if (changed) {
                    n.fxItem = control.add('item', label);
                    n.fxItem.fxNode = n;
                } else if (n.fxItem.text !== label) {
                    n.fxItem.text = label;
                }
                // This is the work selection, including descendants of groups.
                // Focus is tracked separately and never adds an operation target.
                if (n.fxItem.selected !== !!n.fxSelected) {
                    n.fxItem.selected = !!n.fxSelected;
                }
            }
        } finally {
            syncing = false;
        }
    };
    function nativeSelection() {
        var selected = control.selection || [];
        return FX.U.array(selected) ? selected : [selected];
    }
    control.onChange = function () {
        if (syncing) {
            return;
        }
        var selected = nativeSelection(), candidate = keyboardTarget,
            changed = [], i, n, distance = -1, d, origin = -1;
        keyboardTarget = null;
        if (!candidate && shiftGesture && !ctrlGesture && tree.anchor) {
            for (i = 0; i < visible.length; i++) {
                if (visible[i] === tree.anchor) {
                    origin = i;
                }
            }
            for (i = 0; origin >= 0 && i < visible.length; i++) {
                d = Math.abs(i - origin);
                if (visible[i].fxItem.selected && d > distance) {
                    candidate = visible[i];
                    distance = d;
                }
            }
        }
        if (!candidate && !ctrlGesture && selected.length === 1) {
            candidate = selected[0].fxNode;
        }
        if (!candidate) {
            for (i = 0; i < visible.length; i++) {
                n = visible[i];
                if (n === tree.selection) {
                    origin = i;
                }
                if (!!n.fxItem.selected !== !!n.fxSelected) {
                    changed.push(i);
                }
            }
            // Ctrl toggles one row; Shift may change a range. Its endpoint is
            // the changed row furthest from the previous focus.
            for (i = 0; i < changed.length; i++) {
                d = Math.abs(changed[i] - origin);
                if (d > distance) {
                    distance = d;
                    candidate = visible[changed[i]];
                }
            }
        }
        if (candidate) {
            pendingClick = false;
            tree.selection = candidate;
            if (tree.onChange) {
                tree.onChange();
            }
        }
    };
    tree.addEventListener = function (name, callback, capture) {
        control.addEventListener(name, callback, capture);
    };
    function modifiers(event) {
        var keys = {};
        try {
            if (typeof ScriptUI !== 'undefined') {
                keys = ScriptUI.environment.keyboardState;
            }
        } catch (ignoredKeys) {}
        ctrlGesture = !!(event.ctrlKey || event.metaKey || keys.ctrlKey || keys.metaKey);
        shiftGesture = !!(event.shiftKey || keys.shiftKey);
    }
    control.addEventListener('mousedown', function (event) {
        pendingClick = true;
        keyboardTarget = null;
        modifiers(event);
    }, true);
    control.addEventListener('click', function (event) {
        // Clicking an already highlighted row need not emit onChange.
        if (pendingClick) {
            pendingClick = false;
            control.onChange();
        }
        // ScriptUI reports double clicks as click events with detail === 2.
        if (event.detail === 2) {
            toggle(tree.selection, tree.selection && !tree.selection.expanded);
        }
    });
    function toggle(node, expanded) {
        if (!node || node.type !== 'node' || !control.enabled) {
            return;
        }
        node.expanded = expanded;
        if (tree.onExpand) {
            tree.onExpand();
        } else {
            tree.refresh();
        }
    }
    control.addEventListener('keydown', function (event) {
        var key = event.keyName || '', i, index = -1;
        if (syncing) {
            return;
        }
        modifiers(event);
        if (key === 'Left' || key === 'Right') {
            toggle(tree.selection, key === 'Right');
            if (event.preventDefault) {
                event.preventDefault();
            }
            return;
        }
        for (i = 0; i < visible.length; i++) {
            if (visible[i] === tree.selection) {
                index = i;
            }
        }
        if (key === 'Up' || key === 'Down') {
            index += key === 'Up' ? -1 : 1;
        } else if (key === 'Home') {
            index = 0;
        } else if (key === 'End') {
            index = visible.length - 1;
        } else {
            keyboardTarget = null;
            return;
        }
        keyboardTarget = visible[Math.max(0, Math.min(visible.length - 1, index))];
    }, true);
    return tree;
};
