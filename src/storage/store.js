FX.Store = function (directory, options) {
    options = options || {};
    // Data identifiers keep the original name (folder, product fields) so
    // existing preferences and presets survive the FXHX rename.
    this.dir = directory || new Folder(Folder.userData.fsName + '/FXExchanger');
    this.baseName = options.baseName || 'state.json';
    FX.U.assert(
        /^[A-Za-z0-9-]+\.json$/.test(this.baseName),
        'Invalid store name'
    );
    this.validateDocument = options.validate || FX.Validate.state;
    this.defaultDocument = options.defaults || FX.Model.state;
    this.migrateDocument = options.migrate || FX.Model.migrate;
    this.lastRaw = null;
    this.recovered = false;
    this.recoverySource = null;
};
FX.Store.prototype.file = function (suffix) {
    return new File(this.dir.fsName + '/' + this.baseName + (suffix || ''));
};
FX.Store.prototype.readText = function (file) {
    FX.U.assert(file.exists, 'File not found');
    FX.U.assert(file.length <= 16777216, 'File size limit');
    file.encoding = 'UTF-8';
    FX.U.assert(file.open('r'), 'Cannot open file');
    var value;
    try {
        value = file.read();
        FX.U.assert(!file.error, 'File read failed');
    } finally {
        file.close();
    }
    return value.replace(/^\uFEFF/, '');
};
FX.Store.prototype.writeText = function (file, text) {
    file.encoding = 'UTF-8';
    FX.U.assert(file.open('w'), 'Cannot write file');
    try {
        FX.U.assert(file.write(text) && !file.error, 'File write failed');
    } finally {
        file.close();
    }
};
FX.Store.prototype.load = function () {
    var current = this.file(),
        candidate,
        s,
        i;
    this.lastRaw = current.exists ? this.readText(current) : null;
    if (this.lastRaw !== null) {
        try {
            s = FX.JSON.parse(this.lastRaw);
            this.validateDocument(s);
            return this.migrateDocument(s);
        } catch (error) {
            /* Try known backups; never silently reset. */
        }
    }
    for (i = 0; i <= 3; i++) {
        candidate = this.file(i === 0 ? '.rollback' : '.bak' + i);
        if (candidate.exists) {
            try {
                s = FX.JSON.parse(this.readText(candidate));
                this.validateDocument(s);
                this.recovered = true;
                this.recoverySource = candidate.fsName;
                return this.migrateDocument(s);
            } catch (error2) {}
        }
    }
    if (current.exists) {
        throw new Error(
            'State and backups are unreadable. Preserve the files and repair or move them before restarting.'
        );
    }
    return this.defaultDocument();
};
FX.Store.prototype.save = function (state) {
    this.validateDocument(state);
    FX.U.assert(
        this.dir.exists || this.dir.create(),
        'Cannot create storage folder'
    );
    var current = this.file(),
        actual = current.exists ? this.readText(current) : null,
        raw = FX.JSON.stringify(state),
        tmp = this.file('.tmp'),
        rollback = this.file('.rollback'),
        i,
        from,
        to;
    FX.U.assert(
        actual === this.lastRaw,
        'Storage changed in another panel/process. Reload before saving.'
    );
    this.writeText(tmp, raw);
    FX.U.assert(this.readText(tmp) === raw, 'Staging verification failed');
    if (current.exists) {
        if (this.recovered) {
            FX.U.assert(
                current.copy(this.file('.corrupt-' + FX.U.now()).fsName),
                'Cannot preserve corrupt state'
            );
        } else {
            for (i = 3; i >= 2; i--) {
                from = this.file('.bak' + (i - 1));
                to = this.file('.bak' + i);
                if (from.exists) {
                    FX.U.assert(from.copy(to.fsName), 'Backup rotation failed');
                }
            }
            FX.U.assert(
                current.copy(this.file('.bak1').fsName),
                'Backup failed'
            );
        }
        FX.U.assert(current.copy(rollback.fsName), 'Rollback copy failed');
        FX.U.assert(current.remove(), 'Cannot stage replacement');
    }
    if (!tmp.rename(this.baseName)) {
        if (rollback.exists) {
            rollback.copy(current.fsName);
        }
        throw new Error('Commit failed; previous state preserved in rollback');
    }
    this.lastRaw = raw;
    this.recovered = false;
    if (rollback.exists) {
        rollback.remove();
    }
};
FX.Store.prototype.backup = function () {
    var f = this.file();
    if (f.exists) {
        FX.U.assert(
            f.copy(this.file('.before-import-' + FX.U.now()).fsName),
            'Import backup failed'
        );
    }
};
