FX.Scanner = function (adapter) {
    this.adapter = adapter;
    this.job = null;
    this.result = null;
    this.basic = null;
    this.inventoryCache = null;
    this.configurations = {};
    this.analyses = [];
    this.analysisRevision = 0;
    this.task = null;
    this.ticking = false;
    this.onProgress = function () {};
    this.onDone = function () {};
    this.onObserverError = function () {};
};
// Basic Scan never captures property values or builds configuration fingerprints.
FX.Scanner.prototype.start = function (scope, ids) {
    // Prepare first: a failed scope lookup must not erase a usable session.
    var phaseStarted = FX.U.now(),
        cursor;
    try {
        cursor = this.adapter.scanCursor(scope || 'active', ids);
    } catch (error) {
        // Preserve a valid same-project session, never a snapshot of another project.
        try {
            if (this.basic && this.basic.project !== this.adapter.project()) {
                this.invalidate();
            }
        } catch (projectError) {
            this.invalidate();
        }
        throw error;
    }
    this.cancel();
    if (this.basic) {
        this.basic.stale = true;
    }
    if (this.result) {
        this.result.stale = true;
    }
    this.inventoryCache = null;
    this.job = {
        phase: 'basic',
        id: FX.U.id('scan'),
        cursor: cursor,
        layers: [],
        instances: [],
        scope: scope || 'active',
        startedAt: phaseStarted
    };
    this.adapter.diagnostics.measure(
        'scopePreparation',
        FX.U.now() - phaseStarted,
        this.job.cursor.comps.length
    );
    this.adapter.diagnostics.add('scanner', '', 'basic-start');
};
// Deep reads are a separate requested phase over a completed inventory; callers
// may continue an explicit edit by rereading only its recovered work targets.
FX.Scanner.prototype.analyze = function (filters, targets) {
    var phaseStarted = FX.U.now();
    FX.U.assert(
        !this.job &&
            this.basic &&
            !this.basic.stale &&
            this.basic.project === this.adapter.project(),
        'Complete a fresh Basic Scan first.'
    );
    var base = this.basic,
        request = FX.U.clone(filters || {}),
        candidates = FX.Filters.apply(base, request, true),
        index = {},
        i;
    if (request.animation && request.animation !== 'Any') {
        var known = [],
            observed;
        for (i = 0; i < candidates.instances.length; i++) {
            observed =
                this.configurations[
                    '$' + FX.Model.effectKey(candidates.instances[i])
                ];
            if (
                !observed ||
                !observed.configuration ||
                FX.Animation.matches(
                    observed ? observed.configuration : null,
                    request.animation
                )
            ) {
                known.push(candidates.instances[i]);
            }
        }
        candidates.instances = known;
    }
    if (targets) {
        var allowed = {},
            scoped = [];
        for (i = 0; i < targets.length; i++) {
            FX.U.assert(targets[i].scanId === base.id, 'Mixed scan results');
            allowed['$' + FX.Model.effectKey(targets[i])] = true;
        }
        for (i = 0; i < candidates.instances.length; i++) {
            if (allowed['$' + FX.Model.effectKey(candidates.instances[i])]) {
                scoped.push(candidates.instances[i]);
            }
        }
        candidates.instances = scoped;
    }
    for (i = 0; i < base.layers.length; i++) {
        index['$' + FX.Model.layerKey(base.layers[i])] = base.layers[i];
    }
    this.result = null;
    this.job = {
        phase: 'configuration',
        id: base.id,
        base: base,
        filters: request,
        layers: candidates.layers,
        candidates: candidates.instances,
        index: 0,
        instances: [],
        layerIndex: index,
        validated: {},
        cache: {},
        errors: 0
    };
    this.job.startedAt = phaseStarted;
    this.adapter.diagnostics.measure(
        'analysisPreparation',
        FX.U.now() - phaseStarted,
        candidates.instances.length
    );
    this.adapter.diagnostics.add(
        'scanner',
        '',
        'configuration-start; candidates=' + candidates.instances.length
    );
};
FX.Scanner.prototype.tick = function () {
    if (!this.job || this.ticking) {
        return false;
    }
    this.ticking = true;
    var job = this.job,
        deadline = FX.U.now() + FX.Scanner.SLICE_MS,
        count = 0,
        event,
        item,
        fp,
        bucket,
        key,
        i,
        stepStarted,
        readStarted;
    try {
        while (count < FX.Scanner.SLICE_STEPS && FX.U.now() < deadline) {
            stepStarted = FX.U.now();
            if (job.phase === 'basic') {
                if (job.cursor.done) {
                    break;
                }
                event = this.adapter.scanNext(job.cursor, job.id);
                if (event && event.kind === 'layer') {
                    job.layers.push(event.value);
                } else if (event) {
                    job.instances.push(event.value);
                }
            } else {
                FX.U.assert(
                    job.base.project === this.adapter.project(),
                    'Project changed during Configuration Analysis'
                );
                if (job.index >= job.candidates.length) {
                    break;
                }
                item = job.candidates[job.index++];
                key = '$' + FX.Model.layerKey(item);
                if (!job.validated[key]) {
                    this.adapter.validateLayer(job.layerIndex[key], true);
                    job.validated[key] = true;
                }
                readStarted = FX.U.now();
                try {
                    item = this.adapter.analyzeOccurrence(item, job.filters);
                } finally {
                    this.adapter.diagnostics.measure(
                        'occurrenceRead',
                        FX.U.now() - readStarted,
                        1
                    );
                }
                if (item) {
                    fp = item.fingerprint;
                    key = '$' + fp.hash;
                    bucket = job.cache[key] || [];
                    for (i = 0; i < bucket.length; i++) {
                        if (bucket[i].canonical === fp.canonical) {
                            item.fingerprint = bucket[i];
                            break;
                        }
                    }
                    if (i === bucket.length) {
                        bucket.push(fp);
                        job.cache[key] = bucket;
                    }
                    job.instances.push(item);
                }
            }
            this.adapter.diagnostics.measure(
                'scanStep',
                FX.U.now() - stepStarted,
                1
            );
            count++;
        }
        var done =
            job.phase === 'basic'
                ? job.cursor.done
                : job.index >= job.candidates.length;
        var position = job.phase === 'basic' ? job.cursor.comp : job.index;
        var total =
            job.phase === 'basic'
                ? job.cursor.comps.length
                : job.candidates.length;
        this.notify('onProgress', [
            job.layers.length,
            job.instances.length,
            position,
            total,
            job.phase
        ]);
        if (this.job !== job) {
            return !!this.job;
        }
        if (done) {
            if (job.phase === 'basic') {
                this.configurations = {};
                this.analyses = [];
                this.analysisRevision = 0;
                this.inventoryCache = null;
                this.result = {
                    id: job.id,
                    project: job.cursor.project,
                    scope: job.scope,
                    layers: job.layers,
                    instances: job.instances,
                    scannedAt: FX.U.now(),
                    stale: false,
                    errorCount: job.cursor.errors,
                    analysisState: 'basic',
                    filters: null
                };
                this.basic = this.result;
            } else {
                var filtered = FX.Filters.apply(
                    { layers: job.layers, instances: job.instances },
                    job.filters
                );
                this.result = {
                    id: job.id,
                    project: job.base.project,
                    scope: job.base.scope,
                    layers: filtered.layers,
                    instances: filtered.instances,
                    scannedAt: job.base.scannedAt,
                    analyzedAt: FX.U.now(),
                    stale: false,
                    errorCount: job.base.errorCount + job.errors,
                    analysisState: 'analyzed',
                    filters: job.filters
                };
                var keys = [];
                for (i = 0; i < job.candidates.length; i++) {
                    delete this.configurations[
                        '$' + FX.Model.effectKey(job.candidates[i])
                    ];
                }
                // A captured non-match still has useful, authorized classification data.
                for (i = 0; i < job.instances.length; i++) {
                    item = job.instances[i];
                    key = '$' + FX.Model.effectKey(item);
                    this.configurations[key] = item;
                }
                for (i = 0; i < filtered.instances.length; i++) {
                    keys.push('$' + FX.Model.effectKey(filtered.instances[i]));
                }
                this.analyses.push({
                    at: this.result.analyzedAt,
                    filters: job.filters,
                    keys: keys
                });
                this.analysisRevision++;
                this.inventoryCache = null;
                if (this.analyses.length > 20) {
                    this.analyses.shift();
                }
            }
            this.adapter.diagnostics.measure(
                job.phase === 'basic' ? 'basicScan' : 'configurationAnalysis',
                FX.U.now() - job.startedAt,
                job.instances.length
            );
            this.adapter.diagnostics.add(
                'scanner',
                '',
                job.phase + '-complete; effects=' + job.instances.length
            );
            this.job = null;
            this.notify('onDone', [this.result]);
            // onDone may explicitly request the second phase. Its next tick stays cancellable.
            return !!this.job;
        }
        return true;
    } catch (error) {
        if (typeof stepStarted === 'number') {
            this.adapter.diagnostics.measure(
                'failedStep',
                FX.U.now() - stepStarted,
                1
            );
        }
        this.adapter.diagnostics.error('scan-read', error);
        this.invalidate();
        throw error;
    } finally {
        this.ticking = false;
    }
};
// Presentation observers cannot turn a completed read into a stale/failed scan.
FX.Scanner.prototype.notify = function (name, args) {
    try {
        this[name].apply(this, args);
    } catch (error) {
        try {
            this.adapter.diagnostics.error('presentation/' + name, error);
        } catch (ignoredDiagnostic) {}
        try {
            this.onObserverError(name, error);
        } catch (ignoredObserver) {}
    }
};
FX.Scanner.prototype.cancel = function () {
    if (this.job) {
        this.adapter.diagnostics.measure(
            this.job.phase === 'basic'
                ? 'basicScanCancelled'
                : 'configurationAnalysisCancelled',
            FX.U.now() - this.job.startedAt,
            this.job.instances.length
        );
        this.adapter.diagnostics.add(
            'scanner',
            '',
            this.job.phase + '-cancelled'
        );
    }
    this.job = null;
    if (this.task !== null) {
        var pending = this.task;
        this.task = null;
        try {
            this.adapter.cancelTask(pending);
        } catch (cancelError) {
            this.adapter.diagnostics.add('scheduler', '', 'cancel-failed');
            this.adapter.diagnostics.error('cancel-task', cancelError);
        }
    }
};
FX.Scanner.prototype.invalidate = function () {
    this.cancel();
    this.inventoryCache = null;
    if (this.result) {
        this.result.stale = true;
    }
    if (this.basic) {
        this.basic.stale = true;
    }
};
// After a successful write that cannot add, remove or reorder effects (set,
// copy, enable, disable), the Basic snapshot still describes the project:
// same layers, same effect stacks. Reusing it avoids relisting the whole scope.
// `effects` are the written targets: their stacks are re-checked against the
// host and `enabled` is re-read; configurations for them are dropped so they
// are read again explicitly. Returns false (snapshot stays stale) when
// anything does not match, so the caller falls back to a full Basic scan.
FX.Scanner.prototype.reuseAfterWrite = function (project, effects) {
    var base = this.basic, i, record, layers = {}, layer, target, enabled, checked = {};
    if (this.job || !base || base.project !== project || base.project !== this.adapter.project()) {
        return false;
    }
    for (i = 0; i < base.layers.length; i++) {
        layers['$' + FX.Model.layerKey(base.layers[i])] = base.layers[i];
    }
    var byKey = {};
    for (i = 0; i < base.instances.length; i++) {
        byKey['$' + FX.Model.effectKey(base.instances[i])] = base.instances[i];
    }
    var updates = [];
    try {
        for (i = 0; i < effects.length; i++) {
            record = byKey['$' + FX.Model.effectKey(effects[i])];
            layer = layers['$' + FX.Model.layerKey(effects[i])];
            if (!record || !layer) {
                return false;
            }
            if (!checked['$' + FX.Model.layerKey(layer)]) {
                this.adapter.validateLayer(layer, true);
                checked['$' + FX.Model.layerKey(layer)] = true;
            }
            target = this.adapter.resolve(record);
            enabled = target.effect.canSetEnabled ? !!target.effect.enabled : true;
            updates.push([record, enabled]);
        }
    } catch (changed) {
        this.adapter.diagnostics.add('scanner', '', 'reuse-after-write refused');
        return false;
    }
    for (i = 0; i < updates.length; i++) {
        updates[i][0].enabled = updates[i][1];
        delete this.configurations['$' + FX.Model.effectKey(updates[i][0])];
    }
    base.stale = false;
    this.result = base;
    this.analysisRevision++;
    this.inventoryCache = null;
    this.adapter.diagnostics.add('scanner', '', 'reuse-after-write; effects=' + updates.length);
    return true;
};
FX.Scanner.prototype.current = function () {
    FX.U.assert(
        this.basic &&
            !this.basic.stale &&
            !this.job &&
            this.basic.project === this.adapter.project(),
        'Run a fresh Scan first.'
    );
    return this.inventory();
};
// A lightweight view shares records, configurations and layer arrays with their owners.
// This method is pure: Display Search and rendering never read the host.
FX.Scanner.prototype.inventory = function () {
    if (!this.basic) {
        return null;
    }
    if (this.inventoryCache) {
        this.adapter.diagnostics.measure('inventoryReuse', 0, 1);
        return this.inventoryCache;
    }
    var inventoryStarted = FX.U.now();
    var out = {},
        k,
        i,
        e;
    for (k in this.basic) {
        if (FX.U.own(this.basic, k)) {
            out[k] = this.basic[k];
        }
    }
    out.instances = [];
    for (i = 0; i < this.basic.instances.length; i++) {
        e = this.basic.instances[i];
        out.instances.push(
            this.configurations['$' + FX.Model.effectKey(e)] || e
        );
    }
    out.analysisState = this.analyses.length ? 'analyzed' : 'basic';
    this.inventoryCache = out;
    this.adapter.diagnostics.measure(
        'inventoryBuild',
        FX.U.now() - inventoryStarted,
        out.instances.length
    );
    return out;
};
// Work per scheduler tick. 40 ms keeps the panel responsive while needing
// about 3x fewer AE idle callbacks than the former 12 ms / 30 steps; a single
// slow host call still cannot be interrupted.
FX.Scanner.SLICE_MS = 40;
FX.Scanner.SLICE_STEPS = 150;
