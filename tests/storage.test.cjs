const test = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    path = require('node:path');
const { load } = require('./helpers.cjs');
function fixture(t) {
    const root = path.resolve(__dirname, '../artifacts/storage-tests');
    fs.mkdirSync(root, { recursive: true });
    const directory = fs.mkdtempSync(path.join(root, 'run-'));
    t.after(() => {
        if (!directory.startsWith(root + path.sep))
            throw Error('Unsafe cleanup');
        fs.rmSync(directory, { recursive: true, force: true });
    });
    let failRename = false;
    class Folder {
        constructor(p) {
            this.fsName = p;
        }
        get exists() {
            return fs.existsSync(this.fsName);
        }
        create() {
            fs.mkdirSync(this.fsName, { recursive: true });
            return true;
        }
    }
    class File {
        constructor(p) {
            this.fsName = p;
            this.error = '';
        }
        get exists() {
            return fs.existsSync(this.fsName);
        }
        get length() {
            return fs.statSync(this.fsName).size;
        }
        open(mode) {
            this.mode = mode;
            return true;
        }
        read() {
            return fs.readFileSync(this.fsName, 'utf8');
        }
        write(s) {
            fs.writeFileSync(this.fsName, s, 'utf8');
            return true;
        }
        close() {
            return true;
        }
        copy(p) {
            fs.copyFileSync(this.fsName, p);
            return true;
        }
        remove() {
            fs.unlinkSync(this.fsName);
            return true;
        }
        rename(name) {
            if (failRename) return false;
            fs.renameSync(
                this.fsName,
                path.join(path.dirname(this.fsName), name)
            );
            return true;
        }
    }
    const { FX } = load({ File, Folder });
    return {
        FX,
        store: new FX.Store(new Folder(directory)),
        directory,
        presetStore: () => FX.Presets.store(new Folder(directory)),
        setFailure: () => {
            failRename = true;
        }
    };
}

test('preset storage uses a separate file and retains staging/backups and concurrency checks', (t) => {
    const h = fixture(t),
        library = new h.FX.Presets.Library(h.presetStore());
    const rows = [
        {
            path: [{ matchName: 'Intensity', index: 1 }],
            name: 'Intensity',
            valueType: 'OneD',
            value: 6
        }
    ];
    const p = library.save('Glow', 'ADBE Glo2', rows);
    library.save('Glow changed', p.matchName, p.rows, 0, p.id);
    assert.ok(fs.existsSync(path.join(h.directory, 'presets.json.bak1')));
    assert.equal(fs.existsSync(path.join(h.directory, 'state.json')), false);
    const reopened = new h.FX.Presets.Library(h.presetStore());
    assert.equal(reopened.list()[0].name, 'Glow changed');
    library.save('Glow latest', p.matchName, p.rows, 0, p.id);
    assert.throws(() => reopened.remove(p.id), /another panel/);
    assert.equal(reopened.list().length, 1);
    assert.equal(
        new h.FX.Presets.Library(h.presetStore()).list()[0].name,
        'Glow latest'
    );
});

test('failed preset commit rolls back disk and keeps the last in-memory library', (t) => {
    const h = fixture(t),
        library = new h.FX.Presets.Library(h.presetStore());
    const p = library.save('Glow', 'ADBE Glo2', [
        {
            path: [{ matchName: 'Intensity', index: 1 }],
            name: 'Intensity',
            valueType: 'OneD',
            value: 6
        }
    ]);
    const before = library.exportText();
    h.setFailure();
    assert.throws(() => library.remove(p.id), /Commit failed/);
    assert.equal(library.exportText(), before);
    assert.equal(
        fs.readFileSync(path.join(h.directory, 'presets.json'), 'utf8'),
        before
    );
});
test('preferences stage writes, rotate backups, validate schema and refuse a concurrent writer', (t) => {
    const { FX, store, directory } = fixture(t),
        s = store.load();
    store.save(s);
    for (let i = 0; i < 4; i++) {
        s.preferences.scope = i % 2 ? 'entire' : 'active';
        store.save(s);
    }
    for (let i = 1; i <= 3; i++) {
        assert.ok(fs.existsSync(path.join(directory, 'state.json.bak' + i)));
        FX.Validate.state(
            FX.JSON.parse(
                fs.readFileSync(
                    path.join(directory, 'state.json.bak' + i),
                    'utf8'
                )
            )
        );
    }
    fs.writeFileSync(path.join(directory, 'state.json'), 'external');
    assert.throws(() => store.save(s), /another panel/);
    assert.equal(
        fs.readFileSync(path.join(directory, 'state.json'), 'utf8'),
        'external'
    );
});
test('commit failure restores prior preferences', (t) => {
    const { store, setFailure, directory } = fixture(t),
        s = store.load();
    store.save(s);
    const before = fs.readFileSync(path.join(directory, 'state.json'), 'utf8');
    s.preferences.scope = 'entire';
    setFailure();
    assert.throws(() => store.save(s), /Commit failed/);
    assert.equal(
        fs.readFileSync(path.join(directory, 'state.json'), 'utf8'),
        before
    );
});
test('legacy deep grouping preferences migrate in memory with backup and concurrent-write protection intact', (t) => {
    const { store, directory } = fixture(t);
    const legacy = {
        schemaVersion: 1,
        product: 'FX Exchanger',
        preferences: { scope: 'entire', groupBy: 'type-config' }
    };
    const raw = JSON.stringify(legacy),
        file = path.join(directory, 'state.json');
    fs.writeFileSync(file, raw);
    const s = store.load();
    assert.equal(s.schemaVersion, 2);
    assert.equal(s.preferences.groupBy, 'type');
    assert.equal(s.preferences.scope, 'entire');
    assert.equal(fs.readFileSync(file, 'utf8'), raw);
    store.save(s);
    assert.equal(fs.readFileSync(file + '.bak1', 'utf8'), raw);
});
test('corrupt state recovers only a valid backup, preserving damaged files', (t) => {
    const { FX, store, directory } = fixture(t),
        s = store.load();
    store.save(s);
    s.preferences.scope = 'entire';
    store.save(s);
    fs.writeFileSync(path.join(directory, 'state.json'), 'broken');
    const recovered = store.load();
    assert.equal(store.recovered, true);
    assert.equal(recovered.preferences.scope, 'active');
    store.save(recovered);
    assert.ok(fs.readdirSync(directory).some((n) => n.includes('.corrupt-')));
    FX.Validate.state(store.load());
});
test('unrecoverable corruption and incompatible previous-product profiles never silently reset/import', (t) => {
    const { FX, store, directory } = fixture(t);
    fs.writeFileSync(path.join(directory, 'state.json'), 'broken');
    assert.throws(() => store.load(), /unreadable/);
    assert.throws(
        () => FX.Validate.state({ schemaVersion: 1, profiles: [] }),
        /Unsupported/
    );
    const s = FX.Model.state();
    s.password = 'bad';
    assert.throws(() => FX.Validate.state(s), /Unknown/);
});
