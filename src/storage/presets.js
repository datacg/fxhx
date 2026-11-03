// Data-only, single-effect static parameter presets. Never evaluates imported code.
FX.Presets = (function () {
    function empty() {
        return {
            schemaVersion: 1,
            product: 'FX Exchanger Presets',
            presets: []
        };
    }
    function fields(value, allowed) {
        var k;
        FX.U.assert(
            value && typeof value === 'object' && !FX.U.array(value),
            'Invalid preset object'
        );
        for (k in value) {
            if (FX.U.own(value, k)) {
                FX.U.assert(
                    FX.U.contains(allowed, k),
                    'Unknown preset field: ' + k
                );
            }
        }
    }
    function name(value) {
        FX.U.assert(typeof value === 'string', 'Name required');
        value = value.replace(/^\s+|\s+$/g, '');
        FX.U.assert(
            value.length > 0 &&
                value.length <= 120 &&
                !/[\x00-\x1f]/.test(value),
            'Use a name with 1 to 120 characters'
        );
        return value;
    }
    function validate(doc) {
        fields(doc, ['schemaVersion', 'product', 'presets']);
        FX.U.assert(
            doc.schemaVersion === 1 && doc.product === 'FX Exchanger Presets',
            'Unsupported preset library'
        );
        FX.U.assert(
            FX.U.array(doc.presets) && doc.presets.length <= 1000,
            'Preset limit: 1000'
        );
        var ids = {},
            names = {},
            i,
            j,
            p,
            r,
            k,
            segment;
        for (i = 0; i < doc.presets.length; i++) {
            p = doc.presets[i];
            fields(p, ['id', 'name', 'matchName', 'rows', 'omitted']);
            FX.U.assert(
                typeof p.id === 'string' &&
                    /^[A-Za-z0-9_-]{1,120}$/.test(p.id) &&
                    !ids['$' + p.id],
                'Invalid or duplicate preset ID'
            );
            ids['$' + p.id] = true;
            FX.U.assert(
                p.name === name(p.name) && !names['$' + p.name.toLowerCase()],
                'Invalid or duplicate preset name'
            );
            names['$' + p.name.toLowerCase()] = true;
            FX.U.assert(
                typeof p.matchName === 'string' &&
                    p.matchName.length > 0 &&
                    p.matchName.length <= 256,
                'Invalid effect identity'
            );
            FX.U.assert(
                typeof p.omitted === 'number' &&
                    p.omitted >= 0 &&
                    p.omitted === Math.floor(p.omitted),
                'Invalid omitted count'
            );
            FX.U.assert(
                FX.U.array(p.rows) && p.rows.length <= 4096,
                'Preset parameter limit'
            );
            FX.Validate.rows(p.rows);
            for (j = 0; j < p.rows.length; j++) {
                r = p.rows[j];
                fields(r, ['path', 'name', 'valueType', 'value', 'control']);
                if (r.control) {
                    fields(r.control, ['kind', 'choices', 'source', 'units', 'min', 'max']);
                    if (r.control.source !== undefined) {
                        FX.U.assert(r.control.source === 'host' || r.control.source === 'deep-glow-2', 'Invalid control source');
                    }
                    for (var ci = 0; r.control.choices && ci < r.control.choices.length; ci++) {
                        fields(r.control.choices[ci], ['value', 'label']);
                    }
                }
                FX.U.assert(
                    typeof r.name === 'string' && r.name.length <= 512,
                    'Invalid parameter name'
                );
                for (k = 0; k < r.path.length; k++) {
                    segment = r.path[k];
                    fields(segment, ['matchName', 'index']);
                    FX.U.assert(
                        segment.matchName.length > 0 &&
                            segment.matchName.length <= 256 &&
                            segment.index <= 65535,
                        'Invalid preset path identity'
                    );
                }
            }
        }
        return doc;
    }
    function Library(store) {
        this.store = store || null;
        this.document = validate(store ? store.load() : empty());
    }
    Library.prototype.list = function () {
        return FX.U.clone(this.document.presets);
    };
    Library.prototype.get = function (id) {
        var i;
        for (i = 0; i < this.document.presets.length; i++) {
            if (this.document.presets[i].id === id) {
                return FX.U.clone(this.document.presets[i]);
            }
        }
        throw new Error('Preset not found');
    };
    Library.prototype.commit = function (doc) {
        validate(doc);
        var copy = FX.U.clone(doc);
        if (this.store) {
            this.store.save(copy);
        }
        this.document = copy;
    };
    Library.prototype.save = function (title, matchName, rows, omitted, id) {
        var doc = FX.U.clone(this.document),
            i,
            found = -1;
        for (i = 0; id && i < doc.presets.length; i++) {
            if (doc.presets[i].id === id) {
                found = i;
            }
        }
        FX.U.assert(!id || found >= 0, 'Preset not found');
        var p = {
            id: id || FX.U.id('preset'),
            name: name(title),
            matchName: matchName,
            rows: FX.U.clone(rows),
            omitted: omitted || 0
        };
        if (found >= 0) {
            doc.presets[found] = p;
        } else {
            doc.presets.push(p);
        }
        this.commit(doc);
        return FX.U.clone(p);
    };
    Library.prototype.remove = function (id) {
        var doc = FX.U.clone(this.document),
            i,
            found = false;
        for (i = doc.presets.length - 1; i >= 0; i--) {
            if (doc.presets[i].id === id) {
                doc.presets.splice(i, 1);
                found = true;
            }
        }
        FX.U.assert(found, 'Preset not found');
        this.commit(doc);
    };
    Library.prototype.exportText = function () {
        return FX.JSON.stringify(this.document);
    };
    Library.prototype.importText = function (text) {
        FX.U.assert(
            typeof text === 'string' && text.length <= 16777216,
            'Import size limit'
        );
        var incoming = validate(FX.JSON.parse(text)),
            doc = FX.U.clone(this.document),
            byId = {},
            names = {},
            i,
            p,
            old,
            added = 0,
            skipped = 0;
        for (i = 0; i < doc.presets.length; i++) {
            p = doc.presets[i];
            byId['$' + p.id] = p;
            names['$' + p.name.toLowerCase()] = true;
        }
        for (i = 0; i < incoming.presets.length; i++) {
            p = incoming.presets[i];
            old = byId['$' + p.id];
            if (old) {
                FX.U.assert(
                    FX.JSON.stringify(old) === FX.JSON.stringify(p),
                    'Preset ID conflict: ' + p.name + '. No presets imported.'
                );
                skipped++;
                continue;
            }
            FX.U.assert(
                !names['$' + p.name.toLowerCase()],
                'Preset name conflict: ' +
                    p.name +
                    '. Rename before importing. No presets imported.'
            );
            doc.presets.push(p);
            byId['$' + p.id] = p;
            names['$' + p.name.toLowerCase()] = true;
            added++;
        }
        if (added) {
            this.commit(doc);
        }
        return { added: added, skipped: skipped };
    };
    function store(directory) {
        return new FX.Store(directory, {
            baseName: 'presets.json',
            validate: validate,
            defaults: empty,
            migrate: function (doc) {
                return doc;
            }
        });
    }
    return { empty: empty, validate: validate, Library: Library, store: store };
})();
