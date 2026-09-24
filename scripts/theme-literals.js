#!/usr/bin/env node
/**
 * Dark-mode migration, third pass: the hex literals the first two could not place.
 *
 * `theme-migrate.js` swaps a hex that is the direct value of a style property. What survives it
 * sits in a ternary (`active ? '#7C3AED' : '#9CA3AF'`), a gradient array, an SVG prop or a
 * function argument. Every such literal becomes something read *at the moment it is used*:
 *
 *   - an exact light token  → `activePalette().token` (under `backgroundColor`, white becomes
 *     `background` and a status colour its `…Fill`);
 *   - anything else         → `tone('#hex')`, the per-role dark counterpart in constants/theme.
 *
 * Both are correct inside a makeStyles factory (built per scheme) and inside a render. At
 * module level they are evaluated once, at light — run `theme-tables.js` afterwards, which
 * wraps such tables in `schemed()`.
 *
 * Artwork is never passed to this: a painted illustration is a decision per piece.
 *
 *   node scripts/theme-literals.js [--apply] files...
 */
const ts = require(process.cwd() + '/node_modules/typescript');
const fs = require('fs');

const APPLY = process.argv.includes('--apply');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const LIGHT = {
    text: '#1F2937', textSecondary: '#6B7280', textMuted: '#9CA3AF', border: '#E5E7EB',
    borderLight: '#F3F4F6', surface: '#FAFAFA', canvas: '#F8FAFC', borderSlate: '#E2E8F0',
    borderStrong: '#CBD5E1', primary: '#7C3AED', primaryDark: '#6D28D9', primaryLight: '#A78BFA',
    primaryPale: '#C4B5FD', primarySurface: '#F3E8FF', primaryDeep: '#2E1065', indigo: '#4F46E5',
    success: '#059669', successDeep: '#047857', successSurface: '#ECFDF5', successBand: '#D1FAE5',
    warning: '#B45309', warningSurface: '#FFFBEB', danger: '#DC2626', dangerSurface: '#FEF2F2',
    info: '#1D4ED8', infoSurface: '#EFF6FF', primaryTint: '#F5F3FF', surfaceWarm: '#FDFBF7',
    indigoSurface: '#EEF2FF', alert: '#F43F5E', alertSurface: '#FFF1F2', alertBorder: '#FECDD3',
    teal: '#0F766E', tealSurface: '#F0FDFA', sky: '#0369A1', skySurface: '#F0F9FF', pink: '#BE185D',
    pinkSurface: '#FDF2F8', lime: '#4D7C0F', limeSurface: '#F7FEE7', orange: '#C2410C',
    orangeSurface: '#FFF7ED', amber: '#EA8C00', textOnWarm: '#6F6558',
};
const HEX2TOKEN = {};
for (const [k, v] of Object.entries(LIGHT)) if (!HEX2TOKEN[v]) HEX2TOKEN[v] = k;
const FILL = { primary: 'primaryFill', primaryDark: 'primaryDarkFill', success: 'successFill', warning: 'warningFill', danger: 'dangerFill' };

const expand = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h).toUpperCase();

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    const used = new Set();

    // The property or JSX attribute a literal ultimately feeds, through ternaries and arrays.
    const feeds = (n) => {
        for (let p = n.parent; p; p = p.parent) {
            if (ts.isPropertyAssignment(p)) return p.name.getText(sf);
            if (ts.isJsxAttribute(p)) return p.name.getText(sf);
            if (!(ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p) || ts.isBinaryExpression(p) || ts.isArrayLiteralExpression(p) || ts.isJsxExpression(p) || ts.isAsExpression(p))) return null;
        }
        return null;
    };

    (function walk(n) {
        if (ts.isImportDeclaration(n) || ts.isTypeNode(n)) return;
        if (ts.isStringLiteral(n) && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(n.text)
            && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) {
            const hex = expand(n.text);
            const prop = feeds(n);
            let out;
            if (hex === '#FFFFFF') out = prop === 'backgroundColor' ? 'activePalette().background' : null;
            else if (hex === '#000000') out = null;
            else if (HEX2TOKEN[hex]) {
                const tok = HEX2TOKEN[hex];
                out = `activePalette().${prop === 'backgroundColor' && FILL[tok] ? FILL[tok] : tok}`;
            } else out = `tone('${hex}')`;
            if (out) {
                used.add(out.startsWith('tone') ? 'tone' : 'activePalette');
                // A bare JSX attribute string needs braces to hold an expression.
                if (ts.isJsxAttribute(n.parent)) edits.push([n.getStart(sf), n.getEnd(), `{${out}}`]);
                else edits.push([n.getStart(sf), n.getEnd(), out]);
            }
        }
        ts.forEachChild(n, walk);
    })(sf);

    if (!edits.length) { console.log(`${file}  nothing to do`); continue; }
    let out = src;
    for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + t + out.slice(e);

    const want = ['activePalette', 'tone'].filter((x) => used.has(x));
    const themeImport = /import \{([^}]*)\} from '@\/constants\/theme';/;
    const m = out.match(themeImport);
    if (m) {
        const names = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        for (const w of want) if (!names.includes(w)) names.push(w);
        out = out.replace(themeImport, `import { ${names.join(', ')} } from '@/constants/theme';`);
    } else {
        const imports = [...out.matchAll(/^import [\s\S]*?from ['"][^'"]+['"];[ \t]*$/gm)];
        const line = `import { ${want.join(', ')} } from '@/constants/theme';`;
        if (imports.length) { const last = imports[imports.length - 1]; const end = last.index + last[0].length; out = out.slice(0, end) + '\n' + line + out.slice(end); }
        else out = line + '\n' + out;
    }
    console.log(`${file}  ${edits.length} literal(s)`);
    if (APPLY) fs.writeFileSync(file, out);
}
console.log(APPLY ? 'APPLIED' : 'dry run');
