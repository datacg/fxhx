FX.Diagnostics = function () {
    this.entries = [];
    this.metrics = {};
};
FX.Diagnostics.prototype.add = function (operation, matchName, code) {
    this.entries.push({
        date: FX.U.now(),
        operation: operation,
        matchName: matchName || '',
        code: code || 'operation-failed'
    });
    if (this.entries.length > 500) {
        this.entries.shift();
    }
};
FX.Diagnostics.prototype.text = function () {
    return FX.JSON.stringify({
        productVersion: FX.Updates.installed,
        entries: this.entries,
        metrics: this.metrics
    });
};
// Fixed technical metric names only; no project names, parameter values or vendor errors.
FX.Diagnostics.prototype.measure = function (name, milliseconds, items) {
    var key = '$' + name,
        m = this.metrics[key];
    if (!m) {
        m = { count: 0, totalMs: 0, maxMs: 0, lastMs: 0, items: 0 };
        this.metrics[key] = m;
    }
    m.count++;
    m.totalMs += milliseconds;
    m.lastMs = milliseconds;
    m.maxMs = Math.max(m.maxMs, milliseconds);
    m.items += items || 0;
};

// Error handling must remain usable even when a diagnostic sink fails.
FX.Diagnostics.prototype.error = function (operation, error) {
    var detail = FX.U.errorInfo(error, operation);
    try {
        this.add(operation, '', 'exception');
        this.entries[this.entries.length - 1].error = detail;
    } catch (ignoredDiagnostic) {}
    return detail;
};
