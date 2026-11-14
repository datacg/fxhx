const fs = require('node:fs'),
    path = require('node:path'),
    modules = require('./modules.cjs'),
    acorn = require('acorn');
const { verifyExtendScriptAst } = require('./extendscript-check.cjs');
const root = path.resolve(__dirname, '..'),
    dir = path.join(root, 'artifacts');
fs.mkdirSync(dir, { recursive: true });
const headless = process.argv.includes('--headless');
// Preparation is inert by default. This flag prepares an opted-in native fixture; it never launches AE.
const optedIn = process.argv.includes('--allow-native-host-test');
const source = modules
    .map((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8'))
    .join('\n');
const body =
    '(function(host){var FX={};FX.SmokeDirectory=' +
    JSON.stringify(dir.replace(/\\/g, '/')) +
    ';FX.BundlePath=' +
    JSON.stringify(
        path.join(root, 'dist/FXHX.jsx').replace(/\\/g, '/')
    ) +
    ';FX.HostTestOptIn=' +
    optedIn +
    ';FX.SmokeHeadless=' +
    headless +
    ';\n' +
    source +
    '\n' +
    fs.readFileSync(path.join(root, 'tests/ae-smoke-body.jsx'), 'utf8') +
    '\n}(this));';
verifyExtendScriptAst(acorn.parse(body, { ecmaVersion: 3, locations: true }));
fs.writeFileSync(
    path.join(dir, headless ? 'ae-smoke-headless.jsx' : 'ae-smoke.jsx'),
    '\uFEFF#target aftereffects\n#targetengine "fxexchanger-smoke"\n' + body,
    'utf8'
);
console.log(
    'Prepared artifacts/' +
        (headless ? 'ae-smoke-headless.jsx' : 'ae-smoke.jsx') +
        (optedIn
            ? '; opted-in native fixture, manual execution only.'
            : '; BLOCKED fixture: no host operations are permitted by default.')
);
