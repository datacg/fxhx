const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const gate = require('../tools/host-gate.cjs');

function repo(record) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fxhx-gate-'));
    fs.mkdirSync(path.join(root, 'docs', 'validation'), { recursive: true });
    if (record !== undefined) {
        fs.writeFileSync(gate.recordPath(root, '9.9.9'),
            typeof record === 'string' ? record : JSON.stringify(record));
    }
    return root;
}
function passing() {
    return {
        product: 'FXHX', version: '9.9.9', aeVersion: '26.5', tester: 'QA', date: '2026-11-20',
        checks: Object.fromEntries(gate.REQUIRED.map(id => [id, 'pass']))
    };
}

test('a release without an After Effects record is blocked', () => {
    assert.match(gate.problems(repo(), '9.9.9')[0], /missing docs[\\/]validation[\\/]ae-host-9\.9\.9\.json/);
    assert.match(gate.problems(repo('{nope'), '9.9.9')[0], /unreadable/);
});

test('every required checklist item must pass for the exact version', () => {
    assert.deepEqual(gate.problems(repo(passing()), '9.9.9'), []);
    const failed = passing();
    failed.checks['dpi-100-150-200'] = 'fail';
    delete failed.checks['decimal-comma'];
    failed.version = '9.9.8';
    const issues = gate.problems(repo(failed), '9.9.9');
    assert.ok(issues.some(x => /version must be 9\.9\.9/.test(x)));
    assert.ok(issues.some(x => /dpi-100-150-200" is fail/.test(x)));
    assert.ok(issues.some(x => /decimal-comma" is missing/.test(x)));
});

test('the smoke checklist documents every required check id', () => {
    const text = fs.readFileSync(path.join(__dirname, '../docs/HOST_SMOKE_CHECKLIST.md'), 'utf8');
    for (const id of gate.REQUIRED) assert.ok(text.includes('`' + id + '`'), id);
});
