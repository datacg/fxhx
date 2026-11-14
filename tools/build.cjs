const fs = require('node:fs'),
    path = require('node:path'),
    acorn = require('acorn');
const { verifyExtendScriptAst } = require('./extendscript-check.cjs');
const modules = require('./modules.cjs'),
    root = path.resolve(__dirname, '..');
function check(source, name) {
    try {
        verifyExtendScriptAst(
            acorn.parse(source, {
                ecmaVersion: 3,
                allowReserved: false,
                locations: true
            })
        );
    } catch (e) {
        throw Error(name + ': ' + e.message);
    }
}
const source = modules
    .map((f) => {
        const s = fs.readFileSync(path.join(root, 'src', f), 'utf8');
        check(s, f);
        return '// MODULE: ' + f + '\n' + s;
    })
    .join('\n');
const body =
    '(function(host){\nvar FX={};\n' +
    source +
    '\nFX.UI.start(host);\n}(this));\n';
check(body, 'final JSX body');
const bundle =
    '// FXHX ' +
    require('../package.json').version +
    ' — generated; edit src.\n#target aftereffects\n#targetengine "fxexchanger"\n' +
    body;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(
    path.join(root, 'dist', 'FXHX.jsx'),
    '\uFEFF' + bundle,
    'utf8'
);
check(
    fs
        .readFileSync(path.join(root, 'dist', 'FXHX.jsx'), 'utf8')
        .replace(/^\uFEFF/, '')
        .replace(/^#.*$/gm, ''),
    'emitted JSX'
);
console.log(
    'Built and statically validated dist/FXHX.jsx (' +
        Buffer.byteLength(bundle) +
        ' bytes)'
);
