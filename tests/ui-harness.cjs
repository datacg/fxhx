const assert = require('node:assert/strict');
const { fixture } = require('./helpers.cjs');
function ui(options = {}) {
    const h = fixture(options.hostGlobals || {}),
        windows = [],
        alerts = [],
        confirmations = [],
        dialogHooks = {},
        notifications = { count: 0, depth: 0, maxDepth: 0, overflow: 0 };
    let accept = true,
        acceptPartial = true,
        acceptKeyframes = false;
    class Control {
        constructor(type, text = '', props = {}) {
            this.type = type;
            this.text = text;
            this.props = props;
            this.children = [];
            this.items = [];
            this.subItems = Array.from(
                { length: Math.max(2, (props.numberOfColumns || 1) - 1) },
                () => ({ text: '' })
            );
            this.layout = { layout() {}, resize() {} };
            this.preferredSize = { width: 0, height: 0 };
            this.maximumSize = { width: 10000, height: 10000 };
            this.minimumSize = { width: 0, height: 0 };
            this.enabled = true;
            this.visible = true;
            this.value = false;
            this._selection = null;
            this.selected = false;
        }
        add(type, unused, text, props = {}) {
            if ((type === 'item' || type === 'node') && text === undefined) {
                text = unused;
            }
            const c = new Control(type, Array.isArray(text) ? '' : text, props);
            c.parent = this;
            if (type === 'item' || type === 'node') {
                if (this.props.numberOfColumns) {
                    c.subItems = Array.from(
                        { length: this.props.numberOfColumns - 1 },
                        () => ({ text: '' })
                    );
                }
                c.index = this.items.length;
                this.items.push(c);
            } else this.children.push(c);
            if (Array.isArray(text)) {
                for (const v of text) c.add('item', undefined, v);
            }
            return c;
        }
        set selection(v) {
            const previous = this._selection;
            this._selection = typeof v === 'number' ? this.items[v] || null : v;
            if (this.props.multiselect) {
                const chosen = Array.isArray(this._selection) ? this._selection : [this._selection];
                for (const item of this.items) item.selected = chosen.includes(item);
            }
            if (
                options.selectionNotifications &&
                this.type === 'dropdownlist' &&
                typeof this.onChange === 'function' &&
                (options.selectionNotifications === 'always' ||
                    previous !== this._selection)
            ) {
                notifications.count++;
                notifications.depth++;
                notifications.maxDepth = Math.max(
                    notifications.maxDepth,
                    notifications.depth
                );
                try {
                    if (notifications.depth > 24) {
                        notifications.overflow++;
                        throw Error(
                            'Recursive programmatic selection notification'
                        );
                    }
                    this.onChange();
                } finally {
                    notifications.depth--;
                }
            }
        }
        get selection() {
            if (this.props.multiselect) {
                return this.items.filter((x) => x.selected);
            }
            return this._selection;
        }
        removeAll() {
            this.items = [];
            this.selection = null;
        }
        remove(c) {
            this.children.splice(this.children.indexOf(c), 1);
        }
        show() {
            if (this.text === 'Confirm changes') {
                confirmations.push(
                    this.children
                        .flatMap((x) =>
                            x.type === 'statictext' || x.type === 'edittext'
                                ? [x.text]
                                : x.type === 'listbox' && x.fxChangeTable
                                  ? x.items.map((i) => i.text + ': ' + i.subItems[0].text + ' -> ' + i.subItems[1].text)
                                  : []
                        )
                        .join('\n')
                );
                const partial = this.children.find(
                    (x) => x.type === 'checkbox' && x.text === 'I understand: only compatible effects will change.'
                );
                if (partial && acceptPartial) {
                    partial.value = true;
                    partial.onClick();
                }
                const animation = this.children.find(
                    x => x.type === 'checkbox' && x.text.startsWith('I agree to remove ')
                );
                if (animation && acceptKeyframes) {
                    animation.value = true;
                    animation.onClick();
                }
                const apply = this.children
                    .flatMap((x) => x.children)
                    .find((x) => x.fxTitle === 'Apply');
                this.close(accept && apply.enabled ? 1 : 0);
                return this.closeCode;
            }
            if (dialogHooks[this.text]) {
                dialogHooks[this.text](this);
            }
            return this.closeCode || 0;
        }
        close(code) {
            this.closeCode = code;
            if (this.onClose) this.onClose();
        }
        center() {}
        addEventListener(name, callback) {
            if (
                options.unsupportedWheel &&
                (name === 'wheel' || name === 'mousewheel')
            )
                throw Error('Unsupported wheel event');
            const previous = this['listener_' + name];
            this['listener_' + name] = (event) => {
                if (previous) previous(event);
                callback(event);
            };
        }
    }
    class Window extends Control {
        constructor(type, title) {
            super(type, title);
            windows.push(this);
        }
    }
    class Panel extends Control {}
    h.Window = Window; // UI module resolves globals from its VM, so provide them there.
    h.FX.UI = null;
    const vm = require('node:vm'),
        fs = require('node:fs');
    // fixture exposes the context properties, but loading the UI in a fresh wrapper provides the same services.
    const context = vm.createContext({
        FX: h.FX,
        Window,
        Panel,
        $: h.$,
        app: h.app,
        File: h.File,
        Folder: h.Folder,
        alert: (s) => alerts.push(s),
        confirm: (s) => {
            confirmations.push(s);
            return accept;
        },
        prompt: () => null
    });
    vm.runInContext(
        fs.readFileSync(
            require('node:path').join(__dirname, '../src/ui/panel.js'),
            'utf8'
        ),
        context
    );
    function all(root, type) {
        return root.children
            .flatMap((c) => [c.type === type ? c : null, ...all(c, type)])
            .filter(Boolean);
    }
    function click(root, title) {
        const b = all(root, 'button').find((x) => x.text === title) ||
            all(root, 'button').find((x) => x.fxTitle === title);
        assert.ok(b, 'Button ' + title);
        assert.equal(b.enabled, true);
        b.onClick();
    }
    function start() {
        const p = new Panel('panel');
        h.FX.UI.start(p, {
            adapter: h.adapter,
            noStorage: true,
            autoRefresh: options.autoRefresh,
            presetStore: options.presetStore
        });
        if (options.grouped) {
            const view = grouping(p);
            view.selection = 2;
            view.onChange();
        }
        return p;
    }
    function drain(p) {
        let n = 1000;
        while ((p.fxController.scanner.job || p.fxController.editorTask() !== null) && n-- > 0) {
            const task = p.fxController.scanner.job ? p.fxController.scanner.task : p.fxController.editorTask();
            if (task !== null) {
                const code = h.tasks.get(task);
                assert.ok(code, 'Scheduled callback exists');
                h.tasks.delete(task);
                vm.runInNewContext(code, h.$.global);
            } else {
                p.fxController.scanner.tick();
            }
        }
        assert.ok(n > 0);
    }
    // Stand-in for the former hidden grouping dropdown.
    function grouping(p) {
        const c = p.fxController;
        return {
            get selection() { return { index: c.groupMode() }; },
            set selection(v) { c.setGroupMode(typeof v === 'number' ? v : v.index); },
            onChange() { c.groupChanged(); },
            visible: false
        };
    }
    return {
        ...h,
        grouping,
        windows,
        alerts,
        confirmations,
        notifications,
        dialogHooks,
        all,
        results: (p) => p.fxController.results,
        parameterFields: root => all(root, 'edittext').filter(c => c.fxParameterInput),
        read: p => {
            dialogHooks['More Actions'] = d => click(d, 'Read Parameters');
            click(p, 'More...');
        },
        click,
        start,
        scan: (p) => {
            p.fxController.scan();
            drain(p);
        },
        drain,
        pick: (p, node, modifiers = {}) => {
            const tree = p.fxController.results;
            if (tree.control.listener_mousedown) tree.control.listener_mousedown(modifiers);
            tree.selection = node;
            tree.onChange();
            if (tree.control.listener_click) tree.control.listener_click(modifiers);
        },
        more: (p, title) => {
            dialogHooks['More Actions'] = (d) => click(d, title);
            click(p, 'More...');
        },
        select: (p, title = 'Select All') => {
            const tree = p.fxController.results;
            if (!p.fxController.selected().layers.length) {
                tree.selection = tree.items[0];
                tree.onChange();
            }
            dialogHooks['Operation selection'] = (d) => click(d, title);
            dialogHooks['More Actions'] = (d) => click(d, 'Selection...');
            click(p, 'More...');
        },
        analyzed: (p) => {
            p.fxController.scan();
            drain(p);
            const tree = p.fxController.results;
            tree.selection = tree.items[0];
            tree.onChange();
            p.fxController.analyze();
            drain(p);
            const g = grouping(p);
            g.selection = 0;
            g.onChange();
            dialogHooks['More Actions'] = (d) => click(d, 'Clear Selection');
            click(p, 'More...');
        },
        setPartialConsent: (v) => {
            acceptPartial = v;
        },
        setConfirm: (v) => {
            accept = v;
        },
        setKeyframeConsent: (v) => { acceptKeyframes = v; },
        Panel
    };
}
function nodes(n) {
    return Array.from(n.items).flatMap((x) => [x, ...nodes(x)]);
}

module.exports = { ui, nodes };
