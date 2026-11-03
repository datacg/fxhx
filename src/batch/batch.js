FX.Batch = function (adapter, scanner) {
    this.adapter = adapter;
    this.scanner = scanner;
};
FX.Batch.prototype.preview = function (targets, operation, options) {
    FX.U.assert(
        FX.U.contains(
            ['set', 'copy', 'enable', 'disable', 'remove', 'apply'],
            operation
        ),
        'Unknown operation'
    );
    FX.U.assert(targets.length > 0, 'Select results first');
    options = options || {};
    FX.U.assert(!options.requireAll || operation === 'set', 'All-selected editing requires a set operation');
    if (operation === 'set' || operation === 'copy') {
        FX.Validate.rows(options.rows);
        for (var policyTarget = 0; policyTarget < targets.length; policyTarget++) {
            var policyConfig = targets[policyTarget].configuration,
                policyProfile = FX.Parameters.fromConfig(policyConfig);
            for (var policyRow = 0; policyRow < options.rows.length; policyRow++) {
                FX.U.assert(!FX.Parameters.blocked(policyProfile, options.rows[policyRow].path,
                    options.rows[policyRow].name, options.rows[policyRow].valueType),
                    'Internal/system parameters are protected; select public effect controls only');
                var targetRow = FX.Config.row(policyConfig, options.rows[policyRow].path),
                    requestedControl = options.rows[policyRow].control;
                if (targetRow && !targets[policyTarget].locked && requestedControl && requestedControl.kind === 'menu') {
                    FX.U.assert(targetRow.control && targetRow.control.kind === 'menu' &&
                        FX.JSON.stringify(targetRow.control.choices) === FX.JSON.stringify(requestedControl.choices),
                        'Dropdown options differ from this source/preset; select compatible targets');
                }
            }
        }
    }
    var removalRequests = options.removeKeyframes || [],
        removals = {}, removalSeen = {}, ri, rj, requestedRow, animation, found, removalCount = 0;
    FX.U.assert(FX.U.array(removalRequests), 'Invalid keyframe removal paths');
    FX.U.assert(!removalRequests.length || operation === 'set',
        'Keyframe removal is available only in the parameter editor');
    for (ri = 0; ri < removalRequests.length; ri++) {
        key = '$' + FX.Config.key(removalRequests[ri]);
        FX.U.assert(!removalSeen[key], 'Duplicate keyframe removal path');
        removalSeen[key] = true;
        requestedRow = null;
        for (rj = 0; rj < options.rows.length; rj++) {
            if (FX.Config.key(options.rows[rj].path) === FX.Config.key(removalRequests[ri])) {
                requestedRow = options.rows[rj];
            }
        }
        FX.U.assert(requestedRow, 'Keyframe removal requires a new fixed value');
        found = false;
        for (rj = 0; rj < targets.length; rj++) {
            animation = FX.Config.state(targets[rj].configuration, requestedRow.path);
            if (!targets[rj].locked && FX.Config.removable(animation) && animation.valueType === requestedRow.valueType) {
                key = '$' + FX.Model.effectKey(targets[rj]);
                if (!removals[key]) {
                    removals[key] = [];
                }
                var authorization = { path: requestedRow.path, valueType: requestedRow.valueType, keyCount: animation.keyCount };
                if (requestedRow.keepCurrent) {
                    FX.U.assert(FX.U.own(animation, 'currentValue'), 'Current value unavailable; enter a fixed value');
                    authorization.currentValue = FX.U.clone(animation.currentValue);
                }
                removals[key].push(authorization);
                removalCount += animation.keyCount;
                found = true;
            }
        }
        FX.U.assert(found, 'No eligible keyframes for this parameter; read parameters again');
    }
    var targetRows = {}, tr, tj, change, occurrence, resolved, status;
    if (operation === 'set') {
        for (tr = 0; tr < targets.length; tr++) {
            occurrence = targets[tr];
            resolved = FX.U.clone(options.rows);
            for (tj = 0; tj < resolved.length; tj++) {
                change = resolved[tj];
                status = FX.Presentation.parameterStatus(occurrence, change.path);
                if (change.keepCurrent) {
                    FX.U.assert(removalSeen['$' + FX.Config.key(change.path)], 'Keeping current values requires explicit keyframe removal');
                    FX.U.assert(status.hasValue, 'Current value unavailable; enter a fixed value');
                    change.value = FX.U.clone(status.currentValue);
                    delete change.keepCurrent;
                }
                if (options.requireAll) {
                    FX.U.assert(!occurrence.locked && status.valueType === change.valueType &&
                        (status.editable || (status.removable && removalSeen['$' + FX.Config.key(change.path)])),
                        'Cannot update all selected effects for ' + change.name + ': ' + status.reason);
                }
            }
            targetRows['$' + FX.Model.effectKey(occurrence)] = resolved;
        }
    }
    if (operation === 'apply') {
        FX.U.assert(
            typeof options.matchName === 'string' &&
                options.matchName.length > 0,
            'Choose an effect'
        );
        if (options.rows) {
            FX.Validate.rows(options.rows);
            FX.U.assert(FX.Parameters.rows(options.matchName, options.rows).length === options.rows.length,
                'Internal/system parameters are protected; use public effect parameters in presets');
        }
    }
    var scan = this.scanner.current(),
        seen = {},
        i,
        t,
        key,
        comps = {},
        layers = {},
        nc = 0,
        nl = 0;
    for (i = 0; i < targets.length; i++) {
        t = targets[i];
        FX.U.assert(t.scanId === scan.id, 'Mixed scan results');
        key = FX.Model.layerKey(t);
        if (!layers['$' + key]) {
            layers['$' + key] = true;
            nl++;
        }
        if (!comps['$' + t.compId]) {
            comps['$' + t.compId] = true;
            nc++;
        }
        if (operation !== 'apply') {
            FX.U.assert(t.effectIndex, 'Select effect occurrences');
            if (operation === 'set' || operation === 'copy') {
                FX.U.assert(
                    t.configuration && t.fingerprint,
                    'Run Configuration Analysis before editing parameters.'
                );
            }
            key = FX.Model.effectKey(t);
        }
        FX.U.assert(!seen['$' + key], 'Duplicate target');
        seen['$' + key] = true;
    }
    return {
        scanId: scan.id,
        project: scan.project,
        operation: operation,
        targets: FX.U.clone(targets),
        options: FX.U.clone(options),
        keyframeRemovals: FX.U.clone(removals),
        keyframeCount: removalCount,
        targetRows: targetRows,
        layerCount: nl,
        compCount: nc
    };
};
// One synchronous batch at a time; callbacks can report progress but never re-enter writes.
FX.Batch.prototype.execute = function (plan) {
    FX.U.assert(!this.executing, 'A batch is already executing');
    var started = FX.U.now();
    this.executing = true;
    this.lastReport = null;
    try {
        return this._execute(plan);
    } finally {
        this.executing = false;
        this.scanner.invalidate();
        FX.U.measure(this.adapter.diagnostics, 'totalBatch', started, 1);
    }
};
FX.Batch.prototype._execute = function (plan) {
    var self = this,
        scan = this.scanner.current(),
        layerIndex = {},
        validated = {},
        blocked = {},
        i,
        t,
        key,
        report = {
            failedBeforeWrite: 0,
            changed: 0,
            created: 0,
            skipped: 0,
            failed: 0,
            written: 0,
            verified: 0,
            verificationFailed: 0,
            unknown: 0,
            propertiesSkipped: 0,
            keyframesRemoved: 0,
            outcomes: [],
            issues: [],
            affectedCompositions: [],
            completed: false
        };
    this.lastReport = report;
    FX.U.assert(
        plan.scanId === scan.id && plan.project === scan.project,
        'Scan is no longer current'
    );
    for (i = 0; i < scan.layers.length; i++) {
        layerIndex['$' + FX.Model.layerKey(scan.layers[i])] = FX.U.clone(
            scan.layers[i]
        );
    }
    var prevalidationStarted = FX.U.now();
    try {
        // All targets must pass before any write. Read neighbours' structure only.
        for (i = 0; i < plan.targets.length; i++) {
            t = plan.targets[i];
            key = '$' + FX.Model.layerKey(t);
            if (!validated[key]) {
                var row = layerIndex[key];
                FX.U.assert(row, 'Layer absent from scan');
                var target = this.adapter.resolveLayer(row);
                if (target.layer.locked) {
                    FX.U.assert(!plan.options.requireAll, 'A selected layer is locked; no effects were changed');
                    blocked[key] = true;
                } else {
                    this.adapter.validateLayer(row);
                }
                validated[key] = true;
            }
        }
        for (i = 0; i < plan.targets.length; i++) {
            t = plan.targets[i];
            key = '$' + FX.Model.layerKey(t);
            if (plan.operation !== 'apply' && !blocked[key]) {
                var checked = this.adapter.validateOccurrence(t, layerIndex[key]);
                this.adapter.validateKeyframeRemoval(checked.effect,
                    (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(t)] || []);
                if (plan.options.requireAll) {
                    this.adapter.validateEditRows(checked.effect,
                        plan.targetRows['$' + FX.Model.effectKey(t)],
                        (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(t)] || []);
                }
            }
        }
    } catch (validationError) {
        report.failed = plan.targets.length;
        report.failedBeforeWrite = plan.targets.length;
        report.issues.push({
            status: 'Failed Before Write',
            reason: FX.U.errorText(validationError, 'batch-prevalidation')
        });
        throw validationError;
    } finally {
        FX.U.measure(
            this.adapter.diagnostics,
            'prevalidation',
            prevalidationStarted,
            plan.targets.length
        );
    }
    var ordered = plan.targets.slice(0),
        enteredUndo = false;
    ordered.sort(function (a, b) {
        if (a.compId !== b.compId) {
            return a.compId - b.compId;
        }
        if (a.layerIndex !== b.layerIndex) {
            return a.layerIndex - b.layerIndex;
        }
        return (b.effectIndex || 0) - (a.effectIndex || 0);
    });
    function issue(t, status, reason) {
        report.issues.push({ target: t, status: status, reason: reason });
    }
    try {
        this.adapter.undo(
            plan.operation + ' ' + ordered.length + ' targets',
            function () {
                enteredUndo = true;
                for (i = 0; i < ordered.length; i++) {
                    t = ordered[i];
                    key = '$' + FX.Model.layerKey(t);
                    if (blocked[key]) {
                        report.skipped++;
                        issue(
                            t,
                            'Skipped',
                            'Target not attempted: layer locked or previous operation uncertain'
                        );
                        continue;
                    }
                    try {
                        if (self.onProgress) {
                            self.onProgress(i, ordered.length);
                        }
                    } catch (progressError) {
                        self.adapter.diagnostics.error(
                            'batch-progress',
                            progressError
                        );
                    }
                    var r = null,
                        current,
                        created = false,
                        mutationStarted = false;
                    try {
                        FX.U.assert(
                            self.adapter.project() === plan.project,
                            'Project changed during batch'
                        );
                        // Repeat structural validation immediately; account only for our confirmed removals.
                        self.adapter.validateLayer(layerIndex[key]);
                        if (plan.operation === 'apply') {
                            // Mark only the actual host invocation, after availability checks.
                            var added = self.adapter.addEffect(
                                t,
                                plan.options.matchName,
                                function () {
                                    mutationStarted = true;
                                }
                            );
                            created = true;
                            report.created++;
                            if (plan.options.rows) {
                                r = self.adapter.writeRows(
                                    added,
                                    plan.options.rows
                                );
                            }
                        } else {
                            current = self.adapter.validateOccurrence(
                                t,
                                layerIndex[key]
                            );
                            FX.U.assert(
                                !current.layer.locked,
                                'Layer became locked'
                            );
                            if (plan.operation === 'remove') {
                                mutationStarted = true;
                                current.effect.remove();
                                var stack = FX.JSON.parse(
                                        layerIndex[key].stackSignature
                                    ),
                                    si;
                                stack.splice(t.effectIndex - 1, 1);
                                for (si = 0; si < stack.length; si++) {
                                    stack[si].index = si + 1;
                                }
                                layerIndex[key].stackSignature =
                                    FX.JSON.stringify(stack);
                            } else if (
                                plan.operation === 'enable' ||
                                plan.operation === 'disable'
                            ) {
                                FX.U.assert(
                                    current.effect.canSetEnabled,
                                    'Effect cannot change enabled state'
                                );
                                mutationStarted = true;
                                current.effect.enabled =
                                    plan.operation === 'enable';
                            } else {
                                mutationStarted = true;
                                r = self.adapter.writeRows(
                                    current.effect,
                                    (plan.targetRows || {})['$' + FX.Model.effectKey(t)] || plan.options.rows,
                                    { keyframes: (plan.keyframeRemovals || {})['$' + FX.Model.effectKey(t)] || [] }
                                );
                            }
                        }
                        if (r) {
                            report.failedBeforeWrite += r.failedBeforeWrite;
                            report.written += r.written;
                            report.verified += r.verified;
                            report.verificationFailed += r.verificationFailed;
                            report.unknown += r.unknown;
                            report.propertiesSkipped += r.skipped;
                            report.keyframesRemoved += r.keyframesRemoved || 0;
                            report.outcomes.push({
                                target: t,
                                properties: r.outcomes
                            });
                        }
                        if (r && r.failed) {
                            report.failed++;
                            issue(t, 'Property results', r.reasons.join('\n'));
                            if (r.written || r.keyframesRemoved || created) {
                                report.changed++;
                            }
                            if (r.animationMutationAttempted && r.unknown) {
                                blocked[key] = true;
                            }
                        } else if (r && !r.written) {
                            if (created) {
                                report.changed++;
                            } else {
                                report.skipped++;
                            }
                            issue(
                                t,
                                'Skipped',
                                r.reasons.join('\n') ||
                                    'No compatible static properties'
                            );
                        } else {
                            report.changed++;
                            if (r && r.skipped) {
                                issue(t, 'Skipped', r.reasons.join('\n'));
                            }
                        }
                        if (
                            (!r || r.written || r.unknown || created) &&
                            !FX.U.contains(
                                report.affectedCompositions,
                                t.compId
                            )
                        ) {
                            report.affectedCompositions.push(t.compId);
                        }
                    } catch (error) {
                        report.failed++;
                        if (created) {
                            report.changed++;
                        }
                        var status = 'Failed Before Write';
                        if (mutationStarted) {
                            status = 'Unknown After Host Error';
                            report.unknown++;
                            // Structural mutation may have happened. Never touch another target on this layer.
                            blocked[key] = true;
                            if (
                                !FX.U.contains(
                                    report.affectedCompositions,
                                    t.compId
                                )
                            ) {
                                report.affectedCompositions.push(t.compId);
                            }
                        }
                        if (!mutationStarted) {
                            report.failedBeforeWrite++;
                        }
                        issue(t, status, FX.U.errorText(error, 'batch-target'));
                        self.adapter.diagnostics.error('batch-target', error);
                    }
                }
            }
        );
        report.completed = true;
    } catch (hostError) {
        report.failed++;
        var status = 'Failed Before Write';
        if (enteredUndo) {
            status = 'Unknown After Host Error';
            report.unknown++;
        }
        if (!enteredUndo) {
            report.failedBeforeWrite++;
        }
        issue(null, status, FX.U.errorText(hostError, 'batch-undo'));
        this.adapter.diagnostics.error('batch-undo', hostError);
    }
    return report;
};
