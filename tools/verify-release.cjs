const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto'),
    { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
    version = require('../package.json').version;
const zip = path.join(root, 'release', 'FXHX-' + version + '.zip');
const listing = spawnSync('tar.exe', ['-tf', zip], {
    encoding: 'utf8',
    windowsHide: true
});
if (listing.status !== 0)
    throw Error('Windows tar could not read ZIP: ' + listing.stderr);
const names = listing.stdout.trim().split(/\r?\n/);
const allowed = [
    'FXHX.jsx',
    'README.md',
    'INSTALL.md',
    'USER_GUIDE.md',
    'CHANGELOG.md',
    'VALIDATION.md',
    'docs/HOST_SMOKE_CHECKLIST.md',
    'docs/CHANGES_0.1.16.md',
    'MANIFEST.json'
];
if (
    names.length !== allowed.length ||
    names.some((name) => !allowed.includes(name)) ||
    new Set(names).size !== names.length
) {
    throw Error(
        'Distribution contains missing, duplicate or unnecessary files'
    );
}
for (const name of names) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
        throw Error('Unsafe archive path');
}
const base = path.join(root, 'artifacts');
fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'zip-verification-'));
const extracted = spawnSync('tar.exe', ['-xf', zip, '-C', directory], {
    encoding: 'utf8',
    windowsHide: true
});
if (extracted.status !== 0)
    throw Error('ZIP decompression failed: ' + extracted.stderr);
const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'MANIFEST.json'), 'utf8')
);
if (manifest.product !== 'FXHX' || manifest.version !== version)
    throw Error('Wrong manifest identity');
if (names.length !== Object.keys(manifest.files).length + 1)
    throw Error('Unexpected entries');
for (const [name, expected] of Object.entries(manifest.files)) {
    const actual = crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(directory, name)))
        .digest('hex');
    if (actual !== expected) throw Error('SHA-256 mismatch: ' + name);
}
if (
    !fs
        .readFileSync(path.join(directory, 'FXHX.jsx'))
        .equals(fs.readFileSync(path.join(root, 'dist/FXHX.jsx')))
)
    throw Error('Distributed JSX differs from build');
console.log(
    'Windows tar extraction, manifest SHA-256 and JSX byte identity: OK (' +
        names.length +
        ' entries)'
);
console.log(path.relative(root, zip));
console.log(
    manifest.hostValidated
        ? 'Host validation recorded for ' + version + '.'
        : 'CANDIDATE: not validated in After Effects. Do not publish as a release.'
);
