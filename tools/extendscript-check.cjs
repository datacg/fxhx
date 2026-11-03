'use strict';
/**
 * Extra lint layer for Adobe ExtendScript parser quirks.
 * Acorn ES3 syntax acceptance alone does NOT mean ExtendScript compatibility.
 * In particular, Adobe ExtendScript raises "Expected: :" for nested ternaries.
 */
function verifyExtendScriptAst(ast) {
    function visit(node, inConditional = false) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'ConditionalExpression') {
            if (inConditional) {
                const line =
                    node.loc && node.loc.start ? node.loc.start.line : '?';
                throw new Error(
                    'ExtendScript incompatible nested ternary at source line ' +
                        line +
                        '. Use if/else.'
                );
            }
        }
        for (const key of Object.keys(node)) {
            const value = node[key];
            if (Array.isArray(value)) {
                for (const child of value) {
                    if (child && typeof child.type === 'string')
                        visit(
                            child,
                            inConditional ||
                                node.type === 'ConditionalExpression'
                        );
                }
            } else if (value && typeof value.type === 'string') {
                visit(
                    value,
                    inConditional || node.type === 'ConditionalExpression'
                );
            }
        }
    }
    visit(ast);
}
module.exports = { verifyExtendScriptAst };
