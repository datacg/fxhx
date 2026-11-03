const test = require('node:test'),
    assert = require('node:assert/strict');
const { load, plain } = require('./helpers.cjs');
function setup() {
    const { FX } = load();
    let disk = FX.Presets.empty(),
        writes = 0,
        refuse = false;
    const store = {
        load: () => plain(disk),
        save: (doc) => {
            writes++;
            if (refuse) throw Error('Concurrent writer');
            disk = plain(doc);
        }
    };
    return {
        FX,
        store,
        library: new FX.Presets.Library(store),
        rows: [
            {
                path: [{ matchName: 'Intensity', index: 1 }],
                name: 'Intensity',
                valueType: 'OneD',
                value: 6
            }
        ],
        writes: () => writes,
        disk: () => disk,
        refuse: () => (refuse = true)
    };
}

test('single-effect presets save immutable chosen parameters and retain omission counts', () => {
    const h = setup(),
        p = h.library.save(' Soft Glow ', 'ADBE Glo2', h.rows, 3);
    h.rows[0].value = 100;
    p.rows[0].value = 200;
    const first = h.library.list();
    assert.equal(first[0].rows[0].value, 6);
    assert.equal(first[0].name, 'Soft Glow');
    assert.equal(first[0].omitted, 3);
    assert.equal(h.writes(), 1);
    assert.deepEqual(plain(h.FX.Presets.validate(h.disk())), h.disk());
    first[0].name = 'external';
    assert.equal(h.library.list()[0].name, 'Soft Glow');
});

test('export/import all presets roundtrips and skips identical IDs without another write', () => {
    const h = setup();
    h.library.save('Glow A', 'ADBE Glo2', h.rows);
    h.library.save('Glow B', 'ADBE Glo2', [{ ...h.rows[0], value: 7 }]);
    const fresh = new h.FX.Presets.Library(null),
        text = h.library.exportText();
    assert.deepEqual(plain(fresh.importText(text)), { added: 2, skipped: 0 });
    assert.equal(fresh.exportText(), text);
    assert.deepEqual(plain(h.library.importText(text)), {
        added: 0,
        skipped: 2
    });
    assert.equal(h.writes(), 2);
});

test('rename, static value edits and delete preserve identity, validate and persist', () => {
    const h = setup(),
        first = h.library.save('Glow', 'ADBE Glo2', h.rows);
    const changed = [{ ...h.rows[0], value: 9 }];
    const second = h.library.save(
        'Glow revised',
        first.matchName,
        changed,
        0,
        first.id
    );
    assert.equal(second.id, first.id);
    assert.equal(h.library.list().length, 1);
    assert.equal(h.disk().presets[0].rows[0].value, 9);
    h.library.remove(first.id);
    assert.deepEqual(h.disk().presets, []);
    assert.throws(() => h.library.get(first.id), /not found/);
});

test('failed persistence never publishes edited or imported presets to memory', () => {
    const h = setup(),
        p = h.library.save('Glow', 'ADBE Glo2', h.rows),
        before = h.library.exportText();
    h.refuse();
    assert.throws(
        () => h.library.save('Renamed', p.matchName, p.rows, 0, p.id),
        /Concurrent/
    );
    assert.equal(h.library.exportText(), before);
    const incoming = new h.FX.Presets.Library(null);
    incoming.save('Other', 'ADBE Glo2', h.rows);
    assert.throws(
        () => h.library.importText(incoming.exportText()),
        /Concurrent/
    );
    assert.equal(h.library.exportText(), before);
    assert.equal(h.disk().presets.length, 1);
});

test('import conflicts reject the entire merge without overwriting IDs or names', () => {
    const h = setup(),
        existing = h.library.save('Existing', 'ADBE Glo2', h.rows),
        before = h.library.exportText();
    const incoming = h.FX.Presets.empty();
    incoming.presets = [
        { ...plain(existing), id: 'new-preset', name: 'A new one' },
        { ...plain(existing), rows: [{ ...plain(h.rows[0]), value: 12 }] }
    ];
    assert.throws(
        () => h.library.importText(JSON.stringify(incoming)),
        /ID conflict/
    );
    assert.equal(h.library.exportText(), before);
    incoming.presets[1] = { ...plain(existing), id: 'different-id' };
    assert.throws(
        () => h.library.importText(JSON.stringify(incoming)),
        /name conflict/
    );
    assert.equal(h.library.exportText(), before);
    assert.equal(h.writes(), 1);
});

test('malformed, executable, animated or incompatible preset data is rejected without writes', () => {
    const h = setup(),
        p = h.library.save('Glow', 'ADBE Glo2', h.rows),
        before = h.library.exportText();
    const corruptions = [
        (doc) => (doc.schemaVersion = 999),
        (doc) => (doc.execute = 'app.project.close()'),
        (doc) => (doc.presets[0].expression = 'time'),
        (doc) => (doc.presets[0].animation = []),
        (doc) => (doc.presets[0].rows[0].value = '6; app.quit()'),
        (doc) => (doc.presets[0].rows[0].valueType = 'custom'),
        (doc) => (doc.presets[0].rows[0].path = '../licenses'),
        (doc) => (doc.presets[0].rows[0].path[0].file = 'anything'),
        (doc) => (doc.presets[0].rows[0].path[0].index = 0),
        (doc) => doc.presets[0].rows.push(doc.presets[0].rows[0]),
        (doc) => doc.presets.push(doc.presets[0])
    ];
    for (const corrupt of corruptions) {
        const doc = JSON.parse(before);
        corrupt(doc);
        assert.throws(() => h.library.importText(JSON.stringify(doc)));
        assert.equal(h.library.exportText(), before);
    }
    assert.throws(() => h.library.importText('({presets:[]})'));
    assert.throws(
        () => h.library.save('GLOW', p.matchName, h.rows),
        /duplicate preset name/
    );
    assert.equal(h.writes(), 1);
});
