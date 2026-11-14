// Release gate: a release needs a recorded pass of the After Effects smoke
// checklist (docs/HOST_SMOKE_CHECKLIST.md) for this exact version. Node/mock
// tests cannot certify ScriptUI layout, docking, keyboard or host writes.
const fs = require('node:fs'),
    path = require('node:path');

const REQUIRED = [
    'install-and-open',
    'search-and-select',
    'editor-two-pane-layout',
    'decimal-comma',
    'checkbox-parameter',
    'apply-speed',
    'color-hex-and-picker',
    'apply-and-undo',
    'enter-cancels-confirmation',
    'keyframe-removal',
    'progress-and-cancel',
    'presets-multi-edit',
    'dpi-100-150-200',
    'docked-resize-and-scroll',
    'portuguese-locale',
    'update-check'
];

function recordPath(root, version) {
    return path.join(root, 'docs', 'validation', 'ae-host-' + version + '.json');
}

// Returns a list of problems; empty means the version is host-validated.
function problems(root, version) {
    const file = recordPath(root, version);
    if (!fs.existsSync(file)) {
        return ['missing ' + path.relative(root, file)];
    }
    let record;
    try {
        record = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return ['unreadable record: ' + e.message];
    }
    const out = [];
    if (record.product !== 'FXHX') out.push('product must be "FXHX"');
    if (record.version !== version) out.push('version must be ' + version);
    if (typeof record.aeVersion !== 'string' || !record.aeVersion) out.push('aeVersion is required');
    if (typeof record.tester !== 'string' || !record.tester) out.push('tester is required');
    if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) out.push('date must be YYYY-MM-DD');
    const checks = record.checks || {};
    for (const id of REQUIRED) {
        if (checks[id] !== 'pass') out.push('check "' + id + '" is ' + (checks[id] || 'missing'));
    }
    return out;
}

module.exports = { REQUIRED, recordPath, problems };
