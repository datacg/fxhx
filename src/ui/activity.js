// Single source of truth for what the panel is doing. Replaces the former
// `busy` boolean with explicit phases and checked transitions:
//
//   idle ──► listing ──► reading ──► idle
//    │          │           │
//    │          └───────────┴──► idle   (done, cancel or error)
//    └──► applying ──► idle | listing  (automatic refresh after a write)
//
// An unexpected transition is recorded (and reported to diagnostics) but
// still applied, so a missed edge can never leave the panel stuck busy.
FX.Activity = function (onViolation) {
    this.phase = 'idle';
    this.violations = 0;
    this.onViolation = onViolation || null;
};
FX.Activity.PHASES = ['idle', 'listing', 'reading', 'applying'];
FX.Activity.ALLOWED = {
    idle: ['idle', 'listing', 'reading', 'applying'],
    listing: ['idle', 'listing', 'reading'],
    reading: ['idle', 'listing', 'reading'],
    applying: ['idle', 'listing']
};
FX.Activity.prototype.allowed = function (from, to) {
    return FX.U.contains(FX.Activity.ALLOWED[from] || [], to);
};
FX.Activity.prototype.enter = function (phase) {
    FX.U.assert(FX.U.contains(FX.Activity.PHASES, phase), 'Unknown activity phase: ' + phase);
    var from = this.phase;
    if (!this.allowed(from, phase)) {
        this.violations++;
        if (this.onViolation) {
            try { this.onViolation(from, phase); } catch (ignoredObserver) {}
        }
    }
    this.phase = phase;
    return from;
};
FX.Activity.prototype.busy = function () {
    return this.phase !== 'idle';
};
FX.Activity.prototype.cancellable = function () {
    return this.phase === 'listing' || this.phase === 'reading';
};
