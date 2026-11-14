const fs = require('node:fs'),
    path = require('node:path'),
    zlib = require('node:zlib'),
    crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'),
    version = require('../package.json').version,
    gate = require('./host-gate.cjs'),
    candidate = process.argv.includes('--candidate');
const hostProblems = gate.problems(root, version);
if (hostProblems.length && !candidate) {
    console.error('Release blocked: no After Effects validation for ' + version + '.');
    for (const p of hostProblems) console.error('  - ' + p);
    console.error('Run docs/HOST_SMOKE_CHECKLIST.md in AE and record it, or use');
    console.error('"npm run release:candidate" for an unvalidated test build.');
    process.exit(1);
}
const files = [
    ['dist/FXHX.jsx', 'FXHX.jsx'],
    ...[
        'README.md',
        'INSTALL.md',
        'USER_GUIDE.md',
        'CHANGELOG.md',
        'VALIDATION.md',
        'docs/HOST_SMOKE_CHECKLIST.md',
        'docs/CHANGES_0.1.16.md'
    ].map((x) => [x, x])
];
const manifest = {
    product: 'FXHX',
    version,
    hostValidated: hostProblems.length === 0,
    files: {}
};
if (!manifest.hostValidated) {
    console.warn('CANDIDATE build: not validated in After Effects (MANIFEST hostValidated=false).');
}
const entries = files.map(([source, name]) => {
    const data = fs.readFileSync(path.join(root, source));
    manifest.files[name] = crypto
        .createHash('sha256')
        .update(data)
        .digest('hex');
    return { name, data };
});
entries.push({
    name: 'MANIFEST.json',
    data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
});
function crc32(data) {
    let crc = 0xffffffff;
    for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++)
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
const locals = [],
    centrals = [];
let offset = 0;
for (const { name, data } of entries) {
    const filename = Buffer.from(name),
        packed = zlib.deflateRawSync(data),
        crc = crc32(data),
        local = Buffer.alloc(30),
        central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, filename, packed);
    centrals.push(central, filename);
    offset += local.length + filename.length + packed.length;
}
const cd = Buffer.concat(centrals),
    end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(cd.length, 12);
end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
const destination = path.join(
    root,
    'release',
    'FXHX-' + version + '.zip'
);
fs.writeFileSync(destination, Buffer.concat([...locals, cd, end]));
console.log(
    'Created ' +
        path.relative(root, destination) +
        ' with ' +
        entries.length +
        ' verified-input entries.'
);
