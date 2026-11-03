const test = require('node:test');
const assert = require('node:assert/strict');
const { ui, nodes } = require('./ui-harness.cjs');

// Deliver actual list selection changes, in addition to the logical selection
// tests. A native ListBox changes its selected flags before onChange/click.
function nativePick(h, p, node, modifiers = {}) {
    const tree = h.results(p), list = tree.control;
    list.listener_mousedown(modifiers);
    if (modifiers.ctrlKey) node.fxItem.selected = !node.fxItem.selected;
    else list.selection = node.fxItem;
    list.onChange();
    list.listener_click(modifiers);
}

test('native color selection tracks every chosen row and Ctrl removes the clicked row even when one remains', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p), list = tree.control;
    assert.equal(list.type, 'listbox');
    assert.equal(list.props.multiselect, true);
    nativePick(h, p, tree.items[1]);
    nativePick(h, p, tree.items[3], { ctrlKey: true });
    assert.deepEqual(list.selection.map(i => i.fxNode), [tree.items[1], tree.items[3]]);
    assert.equal(p.fxController.selected().instances.length, 2);
    nativePick(h, p, tree.items[3], { ctrlKey: true });
    assert.deepEqual(list.selection.map(i => i.fxNode), [tree.items[1]]);
    assert.equal(tree.selection, tree.items[3]); // focus is not a write target
    assert.equal(p.fxController.selected().instances.length, 1);
    nativePick(h, p, tree.items[1], { ctrlKey: true });
    assert.equal(list.selection.length, 0);
    assert.equal(p.fxController.selected().instances.length, 0);
    h.click(p, 'Select Results');
    assert.equal(list.selection.length, 18);
    h.click(p, 'Clear Selection');
    assert.equal(list.selection.length, 0);
});

test('native Shift and keyboard events select exact targets and duplicate click notifications are harmless', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p), list = tree.control;
    nativePick(h, p, tree.items[2]);
    list.listener_mousedown({ shiftKey: true });
    list.selection = tree.items.slice(2, 6).map(n => n.fxItem);
    list.onChange();
    list.listener_click({ shiftKey: true });
    assert.equal(tree.selection, tree.items[5]);
    assert.deepEqual(list.selection.map(i => i.fxNode), Array.from(tree.items.slice(2, 6)));
    assert.equal(p.fxController.selected().instances.length, 4);
    list.listener_keydown({ keyName: 'Down', shiftKey: true });
    list.selection = tree.items.slice(2, 7).map(n => n.fxItem);
    list.onChange();
    assert.equal(p.fxController.selected().instances.length, 5);
    list.onChange();
    list.listener_click({ shiftKey: true });
    assert.equal(p.fxController.selected().instances.length, 5);
    list.listener_mousedown({ shiftKey: true });
    list.selection = tree.items.slice(2, 5).map(n => n.fxItem);
    list.onChange();
    list.listener_click({ shiftKey: true });
    assert.equal(tree.selection, tree.items[4]);
    assert.equal(p.fxController.selected().instances.length, 3);
});

test('click without a change notification uses the highlighted row rather than an earlier deselected focus', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p), list = tree.control;
    nativePick(h, p, tree.items[0]);
    nativePick(h, p, tree.items[3], { ctrlKey: true });
    nativePick(h, p, tree.items[3], { ctrlKey: true });
    assert.equal(tree.selection, tree.items[3]);
    list.listener_mousedown({});
    list.listener_click({});
    assert.equal(tree.selection, tree.items[0]);
    assert.equal(p.fxController.selected().instances.length, 1);
    assert.equal(tree.items[3].fxItem.selected, false);
});

test('programmatic native selection notifications never change work targets or focus', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p), list = tree.control;
    let notifications = 0;
    for (const item of list.items) {
        let selected = item.selected;
        Object.defineProperty(item, 'selected', {
            get: () => selected,
            set(value) {
                selected = value;
                notifications++;
                list.onChange();
            }
        });
    }
    h.pick(p, tree.items[2]);
    h.click(p, 'Select Results');
    assert.equal(list.selection.length, 18);
    assert.equal(p.fxController.selected().instances.length, 18);
    assert.equal(tree.selection, tree.items[2]);
    h.click(p, 'Clear Selection');
    assert.equal(list.selection.length, 0);
    assert.equal(p.fxController.selected().instances.length, 0);
    assert.equal(tree.selection, null);
    assert.ok(notifications > 18);
});

test('expanding groups highlights selected descendants and partial groups stay distinct from fully selected ones', () => {
    const h = ui({ grouped: true });
    h.glow();
    const p = h.start();
    h.analyzed(p);
    const tree = h.results(p), list = tree.control;
    const group = nodes(tree).find(n => n.fxGroup && n.fxGroup.instances.length === 12);
    nativePick(h, p, group);
    assert.equal(group.fxItem.selected, true);
    list.listener_click({ detail: 2 });
    const comp = group.items[0];
    nativePick(h, p, comp);
    list.listener_click({ detail: 2 });
    const leaf = comp.items[0];
    assert.equal(leaf.fxItem.selected, true);
    nativePick(h, p, leaf, { ctrlKey: true });
    assert.equal(leaf.fxItem.selected, false);
    assert.equal(group.fxItem.selected, false);
    assert.match(group.fxItem.text, /\[-\]/);
    assert.equal(p.fxController.selected().instances.length, 11);
    const selectedBefore = p.fxController.selected().instances.length;
    tree.selection = group;
    list.listener_keydown({ keyName: 'Left', preventDefault() {} });
    assert.equal(group.expanded, false);
    assert.equal(p.fxController.selected().instances.length, selectedBefore);
    list.listener_keydown({ keyName: 'Right', preventDefault() {} });
    assert.equal(group.expanded, true);
    assert.equal(leaf.fxItem.selected, false);
});

test('native highlight failure blocks writes until display is rebuilt', () => {
    const h = ui();
    h.glow();
    const p = h.start();
    h.scan(p);
    const tree = h.results(p), node = tree.items[0];
    Object.defineProperty(node.fxItem, 'selected', {
        get: () => false,
        set() { throw Error('Native highlight unavailable'); }
    });
    h.pick(p, node);
    assert.equal(tree.control.enabled, false);
    assert.equal(h.all(p, 'button').find(b => b.text === 'Disable').enabled, false);
    h.click(p, 'Retry display');
    assert.equal(tree.control.enabled, true);
    assert.equal(tree.items[0].fxItem.selected, true);
    assert.equal(h.calls.filter(c => c[0] === 'set').length, 0);
});

test('mixed Lumetri effects receive only Vibrance 20 while each other value and opaque curve survives', () => {
    const h = ui(), c = h.comp(), effects = [];
    for (let i = 0; i < 4; i++) {
        const layer = c.addLayer();
        const curve = h.prop('Curves', null, 'CUSTOM_VALUE', { name: 'RGB Curves' });
        Object.defineProperty(curve, 'value', {
            get() { throw Error('Opaque curve must never be read'); }
        });
        curve.setValue = () => { throw Error('Opaque curve must never be written'); };
        const props = [
            h.prop('Vibrance', i * 10),
            h.prop('Exposure', i - 1),
            h.prop('Saturation', 80 + i * 5),
            curve,
            h.prop('Animated', i, 'OneD', { numKeys: 2 }),
            h.prop('Expression', i, 'OneD', { expression: 'time * 10' })
        ];
        const effect = h.effect(layer, 'ADBE Lumetri', 0, props);
        effect.name = 'Lumetri Color';
        layer.parade.effects.push(effect);
        effects.push(effect);
    }
    const p = h.start();
    h.scan(p);
    const tree = h.results(p);
    nativePick(h, p, tree.items[0]);
    nativePick(h, p, tree.items[1], { ctrlKey: true });
    nativePick(h, p, tree.items[2], { ctrlKey: true });
    h.read(p);
    h.drain(p);
    h.dialogHooks['Edit Parameters'] = d => {
        const list = h.all(d, 'listbox')[0], fields = h.parameterFields(d);
        assert.equal(list.items[0].text, 'Vibrance');
        assert.equal(list.items[0].subItems[0].text, 'Mixed Values');
        assert.equal(list.items[1].text, 'Exposure');
        assert.equal(list.items[1].subItems[0].text, 'Mixed Values');
        assert.equal(list.items[3].text, 'RGB Curves');
        assert.equal(list.items[3].subItems[2].text, '0/3');
        list.selection = 3;
        list.onChange();
        assert.ok(fields.every(f => !f.enabled));
        assert.ok(h.all(d, 'statictext').some(t => /Edit it in After Effects/.test(t.text)));
        list.selection = 0;
        list.onChange();
        assert.equal(fields[0].text, '');
        fields[0].text = '20';
        fields[0].onChanging();
        h.click(d, 'Apply');
    };
    h.click(p, 'Edit Parameters...');
    h.drain(p);
    effects.forEach((effect, i) => {
        assert.equal(effect.property(1).value, i < 3 ? 20 : 30);
        assert.equal(effect.property(2).value, i - 1);
        assert.equal(effect.property(3).value, 80 + i * 5);
        assert.equal(effect.property(5).numKeys, 2);
        assert.equal(effect.property(6).expression, 'time * 10');
    });
    assert.deepEqual(h.calls.filter(c => c[0] === 'set'), [
        ['set', 'Vibrance', 20], ['set', 'Vibrance', 20], ['set', 'Vibrance', 20]
    ]);
    assert.match(h.confirmations.at(-1), /3 effects \/ 3 layers/);
    assert.equal(h.alerts.length, 0);
});
