const fs = require('node:fs'),
    path = require('node:path'),
    vm = require('node:vm'),
    modules = require('../tools/modules.cjs');
function load(extra = {}) {
    const ctx = vm.createContext({ FX: {}, ...extra });
    for (const f of modules) {
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'),
            ctx,
            { filename: f }
        );
    }
    return ctx;
}
function plain(v) {
    return JSON.parse(JSON.stringify(v));
}
function config(value = 6, unsupported = []) {
    return {
        schemaVersion: 1,
        effectMatchName: 'ADBE Glo2',
        enabled: true,
        properties: [
            {
                path: [{ matchName: 'Intensity', index: 1 }],
                valueType: 'OneD',
                value,
                name: 'Intensity'
            },
            {
                path: [{ matchName: 'Radius', index: 2 }],
                valueType: 'OneD',
                value: 80,
                name: 'Radius'
            }
        ],
        unsupported
    };
}
function fixture(extra = {}) {
    const calls = [],
        tasks = new Map();
    let nextTask = 0,
        nextId = 100;
    const PropertyType = { PROPERTY: 1, INDEXED_GROUP: 2, NAMED_GROUP: 3 },
        PropertyValueType = {
            OneD: 1,
            TwoD: 2,
            ThreeD: 3,
            TwoD_SPATIAL: 4,
            ThreeD_SPATIAL: 5,
            COLOR: 6,
            CUSTOM_VALUE: 7,
            LAYER_INDEX: 8,
            MASK_INDEX: 9,
            NO_VALUE: 10
        };
    class CompItem {
        constructor(name = 'Main') {
            this.id = nextId++;
            this.name = name;
            this.layers = [];
        }
        get numLayers() {
            return this.layers.length;
        }
        layer(i) {
            if (i < 1 || i > this.layers.length) return null;
            return this.layers[i - 1];
        }
        openInViewer() {
            app.project.activeItem = this;
            calls.push(['viewer', this.id]);
        }
        addLayer(LayerType = AVLayer, name = 'Layer', options = {}) {
            const l = Object.assign(new LayerType(), {
                id: nextId++,
                name,
                index: this.layers.length + 1,
                locked: false,
                enabled: true,
                selected: false,
                shy: false,
                threeDLayer: false,
                adjustmentLayer: false,
                label: 5,
                nullLayer: false,
                ...options
            });
            l.parade = parade(l);
            l.property = (n) => (n === 'ADBE Effect Parade' ? l.parade : null);
            this.layers.push(l);
            return l;
        }
        get selectedLayers() {
            return this.layers.filter((x) => x.selected);
        }
    }
    class AVLayer {}
    class CameraLayer {}
    class LightLayer {}
    class TextLayer extends AVLayer {}
    class ShapeLayer extends AVLayer {}
    class SolidSource {}
    class FootageItem {
        constructor(solid = false) {
            this.mainSource = solid ? new SolidSource() : {};
        }
    }
    const app = {
        version: '26.5',
        effects: [
            {
                matchName: 'ADBE Glo2',
                displayName: 'Glow',
                category: 'Stylize',
                version: '1'
            },
            {
                matchName: 'ADBE Slider Control',
                displayName: 'Slider Control',
                category: 'Expression Controls',
                version: '1'
            }
        ],
        project: {
            numItems: 0,
            items: [],
            selection: [],
            activeItem: null,
            item(i) {
                return this.items[i - 1];
            }
        },
        beginUndoGroup(label) {
            calls.push(['begin', label]);
        },
        endUndoGroup() {
            calls.push(['end']);
        },
        scheduleTask(code) {
            const id = ++nextTask;
            tasks.set(id, code);
            return id;
        },
        cancelTask(id) {
            tasks.delete(id);
        }
    };
    const ctx = load({
        ...extra,
        app,
        PropertyType,
        PropertyValueType,
        CompItem,
        AVLayer,
        CameraLayer,
        LightLayer,
        TextLayer,
        ShapeLayer,
        SolidSource,
        FootageItem,
        $: { global: {} }
    });
    const { FX } = ctx;
    // Small slices keep multi-tick paths (cancel, reentry, stale callbacks)
    // covered with small fixtures; production uses FX.Scanner.SLICE_STEPS.
    FX.Scanner.SLICE_STEPS = 30;
    function prop(matchName, value, type = 'OneD', options = {}) {
        return {
            matchName,
            name: matchName,
            propertyType: 1,
            propertyValueType: PropertyValueType[type],
            numKeys: 0,
            canSetExpression: true,
            expression: '',
            expressionEnabled: false,
            value,
            ...options,
            setValue(v) {
                this.value = plain(v);
                calls.push(['set', matchName, plain(v)]);
            }
        };
    }
    function effect(l, name = 'ADBE Glo2', value = 6, properties) {
        const children = properties || [
            prop('Intensity', value),
            prop('Radius', 80)
        ];
        const e = {
            matchName: name,
            name: name === 'ADBE Glo2' ? 'Glow' : 'Slider',
            enabled: true,
            canSetEnabled: true,
            numProperties: children.length,
            property(i) {
                return typeof i === 'number'
                    ? children[i - 1]
                    : children.find((p) => p.matchName === i);
            },
            remove() {
                const n = l.parade.effects.indexOf(this);
                if (n < 0) throw Error('Invalid reference');
                l.parade.effects.splice(n, 1);
                calls.push(['remove', n + 1]);
            },
            children
        };
        return e;
    }
    function parade(l) {
        return {
            effects: [],
            get numProperties() {
                return this.effects.length;
            },
            property(i) {
                return this.effects[i - 1] || null;
            },
            canAddProperty(n) {
                return (
                    !l.incompatible &&
                    !!app.effects.find((x) => x.matchName === n)
                );
            },
            addProperty(n) {
                if (!this.canAddProperty(n)) throw Error('Unavailable');
                const e = effect(l, n);
                this.effects.push(e);
                Object.defineProperty(e, 'propertyIndex', {
                    get: () => this.effects.indexOf(e) + 1
                });
                calls.push(['add', n]);
                return e;
            }
        };
    }
    function comp(name = 'Main') {
        const c = new CompItem(name);
        app.project.items.push(c);
        app.project.numItems = app.project.items.length;
        if (!app.project.activeItem) app.project.activeItem = c;
        return c;
    }
    const adapter = new FX.AfterEffectsAdapter(new FX.Diagnostics()),
        scanner = new FX.Scanner(adapter),
        batch = new FX.Batch(adapter, scanner);
    function scan(scope = 'entire', ids) {
        scanner.start(scope, ids);
        let n = 10000;
        while (scanner.tick() && n-- > 0) {}
        if (n <= 0) throw Error('Scan did not finish');
        scanner.analyze({});
        while (scanner.tick() && n-- > 0) {}
        if (n <= 0) throw Error('Analysis did not finish');
        return scanner.current();
    }
    function glow() {
        const c = comp();
        for (let i = 0; i < 18; i++) {
            const l = c.addLayer(
                i < 3 ? TextLayer : AVLayer,
                i < 3 ? 'Text ' + i : 'Color Adjustment ' + i,
                { adjustmentLayer: i >= 3, source: new FootageItem(true) }
            );
            l.parade.addProperty('ADBE Glo2').property(1).value =
                i < 3 ? 50 : i < 15 ? 6 : 7;
        }
        return c;
    }
    return {
        ...ctx,
        FX,
        app,
        adapter,
        scanner,
        batch,
        calls,
        tasks,
        prop,
        effect,
        comp,
        scan,
        glow,
        CompItem,
        AVLayer,
        TextLayer,
        ShapeLayer,
        CameraLayer,
        LightLayer,
        FootageItem
    };
}
module.exports = { load, plain, config, fixture };
