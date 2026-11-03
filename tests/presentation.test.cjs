const test = require('node:test'),
    assert = require('node:assert/strict');
const { fixture, config, plain } = require('./helpers.cjs');
test('readable grouping marks partial matches without full equality, isolates unknown-only and defeats hash collision', () => {
    const h = fixture();
    h.glow();
    const s = h.scan(),
        a = s.instances[3],
        b = s.instances[4];
    h.FX.Config.diff = () => {
        throw Error(
            'Grouping must use its variation index, not pairwise diffs'
        );
    };
    a.configuration.unsupported.push({
        path: [{ matchName: 'Opaque', index: 3 }],
        reason: 'custom'
    });
    let groups = h.FX.Grouping.build([a, b], 'config');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].complete, false);
    assert.equal(groups[0].matchStatus, 'Matching Readable Settings');
    b.configuration.properties[0].value = 7;
    h.FX.U.hash = () => 'collision';
    groups = h.FX.Grouping.build([a, b], 'config');
    assert.equal(groups.length, 2);
    assert.ok(
        groups.every((g) => g.relationship === 'Different Configurations')
    );
    a.configuration.properties = [];
    b.configuration.properties = [];
    b.configuration.unsupported = a.configuration.unsupported;
    groups = h.FX.Grouping.build([a, b], 'config');
    assert.equal(groups.length, 2);
    assert.ok(groups.every((g) => g.matchStatus === 'Not Comparable'));
});
test('selected comparison covers chosen paths only and summaries omit arbitrary constant values', () => {
    const h = fixture();
    h.glow();
    const s = h.scan(),
        a = s.instances[3],
        b = s.instances[4];
    b.configuration.properties[1].value = 100;
    a.configuration.unsupported.push({
        path: [{ matchName: 'Opaque', index: 3 }],
        reason: 'custom'
    });
    const g = h.FX.Grouping.build([a, b], 'selected', [
        a.configuration.properties[0].path
    ]);
    assert.equal(g.length, 1);
    assert.equal(g[0].matchStatus, 'Exact Comparable Match');
    assert.match(g[0].comparisonScope, /Selected/);
    const exact = h.FX.Grouping.build([a], 'config');
    assert.equal(exact[0].summary.length, 0);
});
test('edit model reports mixed, partial, incompatible and unsafe rows without host reads', () => {
    const h = fixture();
    h.glow();
    const s = h.scan(),
        instances = s.instances.slice(0, 2);
    instances[1].configuration.properties[0].value = 7;
    let rows = h.FX.Presentation.editRows(instances);
    assert.equal(rows[0].current, 'Mixed Values');
    assert.equal(rows[0].category, 'All occurrences');
    const p = instances[1].configuration.properties.pop();
    instances[1].configuration.unsupported.push({
        path: p.path,
        reason: 'keyframed'
    });
    rows = h.FX.Presentation.editRows(instances);
    assert.equal(rows[1].category, 'Some occurrences');
    assert.ok(rows[1].reasons.includes('keyframed'));
    instances[0].configuration.properties.pop();
    rows = h.FX.Presentation.editRows(instances);
    assert.equal(rows[1].category, 'Cannot edit safely');
    instances[1].configuration.properties[0].valueType = 'TwoD';
    rows = h.FX.Presentation.editRows(instances);
    assert.equal(rows[0].safe, false);
});
