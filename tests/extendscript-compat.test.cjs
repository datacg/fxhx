const test = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    path = require('node:path'),
    acorn = require('acorn');
const { verifyExtendScriptAst } = require('../tools/extendscript-check.cjs');
test('ExtendScript regression rejects the original chooseVariant nested conditional and hidden nested conditionals', () => {
    for (const source of [
        'var x = d.show() === 1 ? select.selection.index ? s.variants[select.selection.index - 1].id : null : false;',
        'var x = a ? f(b ? c : d) : e;',
        'var x = (a ? b : c) ? d : e;'
    ]) {
        const ast = acorn.parse(source, { ecmaVersion: 3, locations: true });
        assert.throws(() => verifyExtendScriptAst(ast), /nested ternary/);
    }
    assert.doesNotThrow(() =>
        verifyExtendScriptAst(
            acorn.parse('if (ok) { x = a; } else { x = b; }', {
                ecmaVersion: 3
            })
        )
    );
});
test('all modules and the actual final JSX pass ES3 and extra ExtendScript validation', () => {
    const root = path.resolve(__dirname, '..');
    for (const f of require('../tools/modules.cjs')) {
        verifyExtendScriptAst(
            acorn.parse(fs.readFileSync(path.join(root, 'src', f), 'utf8'), {
                ecmaVersion: 3,
                locations: true
            })
        );
    }
    const bundle = fs.readFileSync(
        path.join(root, 'dist/FXHX.jsx'),
        'utf8'
    );
    assert.ok(bundle.includes('#targetengine "fxexchanger"'));
    const modules = require('../tools/modules.cjs');
    const expected =
        '\uFEFF// FXHX ' +
        require('../package.json').version +
        ' \u2014 generated; edit src.\n#target aftereffects\n#targetengine "fxexchanger"\n' +
        '(function(host){\nvar FX={};\n' +
        modules
            .map(
                (f) =>
                    '// MODULE: ' +
                    f +
                    '\n' +
                    fs.readFileSync(path.join(root, 'src', f), 'utf8')
            )
            .join('\n') +
        '\nFX.UI.start(host);\n}(this));\n';
    assert.ok(
        bundle === expected,
        'Emitted JSX must contain exactly current modules, in manifest order, and the panel entry point'
    );
    assert.equal(new Set(modules).size, modules.length);
    assert.ok(
        !/\b(auditTest|cleanupAudit|runActivationAudit)\s*[:=(]/.test(bundle)
    );
    assert.ok(!/Plugin Hub|PluginHub|pluginhub|\bPH\b/.test(bundle));
    verifyExtendScriptAst(
        acorn.parse(bundle.replace(/^\uFEFF/, '').replace(/^#.*$/gm, ''), {
            ecmaVersion: 3,
            locations: true
        })
    );
});
