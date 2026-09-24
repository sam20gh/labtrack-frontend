#!/usr/bin/env node
/**
 * Dark-mode migration, second pass: module-level colour tables and helpers.
 *
 * `theme-migrate.js` moves components onto the live palette. What it cannot move is colour
 * decided *outside* a component — a status table, a flag's tints, a helper that picks a tone —
 * because there is no hook to call there. This does the two things CLAUDE.md "Dark mode"
 * prescribes for that:
 *
 *   - a module-level table becomes `schemed((Palette, scheme) => …)`, rebuilt per scheme and
 *     read through the active one;
 *   - a module-level function reads `activePalette()` at call time instead of the static import.
 *
 * Inside both, an exact light-token hex becomes that token (a chip fill becomes its `…Fill`,
 * a white background becomes `background`), and any other hex goes through `tone()`.
 *
 * NOT for categorical data colours — a metric's tint, a chart series. Those need a dark set
 * validated as a set. Pass `--skip NAME,NAME` to leave such declarations alone.
 *
 *   node scripts/theme-tables.js lib/orders.ts                      # report
 *   node scripts/theme-tables.js --apply --skip METRIC_TINT lib/*.ts
 */
const ts = require(process.cwd() + '/node_modules/typescript');
const fs = require('fs');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const skipIdx = args.indexOf('--skip');
const SKIP = new Set(skipIdx >= 0 ? args[skipIdx + 1].split(',') : []);
const files = args.filter((a, i) => !a.startsWith('--') && !(skipIdx >= 0 && i === skipIdx + 1));

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
const BG_PROP = /(^bg$|Bg$|background|Background|fill$|Fill$)/;

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    const used = new Set();
    const notes = [];

    const colourOf = (lit, prop, inFn) => {
        const hex = lit.text.toUpperCase().replace(/^#FFF$/, '#FFFFFF');
        if (!/^#[0-9A-F]{6}$/.test(hex)) return null;
        const P = inFn ? 'activePalette()' : 'Palette';
        if (inFn) used.add('activePalette');
        if (hex === '#FFFFFF') return `${P}.${prop && BG_PROP.test(prop) ? 'background' : 'white'}`;
        const tok = HEX2TOKEN[hex];
        if (tok) return `${P}.${prop && BG_PROP.test(prop) && FILL[tok] ? FILL[tok] : tok}`;
        used.add('tone');
        return inFn ? `tone('${hex}')` : `tone('${hex}', scheme)`;
    };

    // Rewrite colour inside a node; returns true if it touched anything.
    const rewrite = (root, inFn) => {
        let touched = false;
        (function walk(n) {
            if (ts.isStringLiteral(n) && /^#[0-9A-Fa-f]{3,6}$/.test(n.text)) {
                const prop = ts.isPropertyAssignment(n.parent) && n.parent.initializer === n ? n.parent.name.getText(sf) : null;
                const out = colourOf(n, prop, inFn);
                if (out) { edits.push([n.getStart(sf), n.getEnd(), out]); touched = true; }
            } else if (ts.isPropertyAccessExpression(n) && n.expression.getText(sf) === 'Palette') {
                const prop = ts.isPropertyAssignment(n.parent) && n.parent.initializer === n ? n.parent.name.getText(sf) : null;
                const name = n.name.text;
                const mapped = prop && BG_PROP.test(prop) && FILL[name] ? FILL[name] : name;
                if (inFn) { edits.push([n.getStart(sf), n.getEnd(), `activePalette().${mapped}`]); used.add('activePalette'); }
                else if (mapped !== name) edits.push([n.name.getStart(sf), n.name.getEnd(), mapped]);
                touched = true;
                return;
            }
            ts.forEachChild(n, walk);
        })(root);
        return touched;
    };

    const hasColour = (node) => /Palette\.|['"]#[0-9A-Fa-f]{6}['"]/.test(node.getText(sf));
    const isFn = (e) => e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e));

    for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.body && hasColour(st.body)) {
            if (st.name && /^[A-Z]/.test(st.name.text)) continue; // a component: theme-migrate's job
            if (st.name && SKIP.has(st.name.text)) continue;
            rewrite(st.body, true);
            continue;
        }
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
            const name = d.name.getText(sf);
            if (!d.initializer || SKIP.has(name) || !hasColour(d.initializer)) continue;
            if (/schemed\(|makeStyles\(|StyleSheet\.create/.test(d.initializer.getText(sf))) continue;
            // A component wrapped in memo()/forwardRef() is not a function literal but is not a table either.
            if (/<[A-Z][\w.]*[\s/>]|<\/[A-Za-z]/.test(d.initializer.getText(sf))) continue;
            if (isFn(d.initializer)) {
                if (/^[A-Z]/.test(name) && /<[A-Z]|React\./.test(d.initializer.getText(sf))) continue; // component
                rewrite(d.initializer, true);
                continue;
            }
            // schemed() needs an object or array; a bare colour value is reported for hand work.
            {
                let e = d.initializer;
                while (e && (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression?.(e))) e = e.expression;
                if (!(ts.isObjectLiteralExpression(e) || ts.isArrayLiteralExpression(e) || ts.isCallExpression(e))) { notes.push(`⚠ ${name} is not a table`); continue; }
            }
            const before = edits.length;
            const hadTone = used.has('tone');
            used.delete('tone');
            rewrite(d.initializer, false);
            const needsScheme = used.has('tone');
            if (hadTone) used.add('tone');
            const init = d.initializer;
            const mentionsPalette = /Palette\./.test(init.getText(sf)) || edits.slice(before).some((e) => e[2].startsWith('Palette.'));
            const params = mentionsPalette ? (needsScheme ? '(Palette, scheme)' : '(Palette)') : (needsScheme ? '(_, scheme)' : '()');
            edits.push([init.getStart(sf), init.getStart(sf), `schemed(${params} => (`]);
            edits.push([init.getEnd(), init.getEnd(), '))']);
            used.add('schemed');
            notes.push(name);
        }
    }

    if (!edits.length) { console.log(`${file}  nothing to do`); continue; }
    let out = src;
    for (const [s, e, t] of edits.sort((a, b) => b[0] - a[0] || b[1] - a[1])) out = out.slice(0, s) + t + out.slice(e);

    // Imports: add what is now used; drop the static Palette if nothing at module level reads it.
    const want = ['schemed', 'tone', 'activePalette'].filter((n) => used.has(n));
    const themeImport = /import \{([^}]*)\} from '@\/constants\/theme';/;
    const reparsed = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    let staticPalette = false;
    (function walk(n) {
        if (ts.isIdentifier(n) && n.text === 'Palette' && !ts.isImportSpecifier(n.parent) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !ts.isParameter(n.parent) && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
            // shadowed by a parameter or a local `const Palette` in an enclosing function?
            let shadowed = false;
            for (let p = n.parent; p && !shadowed; p = p.parent) {
                if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) && p.parameters.some((q) => q.name.getText(reparsed) === 'Palette')) shadowed = true;
                if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) && p.body && ts.isBlock(p.body) && p.body.statements.some((s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((v) => v.name.getText(reparsed) === 'Palette'))) shadowed = true;
            }
            if (!shadowed) staticPalette = true;
        }
        ts.forEachChild(n, walk);
    })(reparsed);
    const m = out.match(themeImport);
    if (m) {
        let names = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        if (!staticPalette) names = names.filter((x) => x !== 'Palette');
        for (const w of want) if (!names.includes(w)) names.push(w);
        out = out.replace(themeImport, `import { ${names.join(', ')} } from '@/constants/theme';`);
    } else if (want.length) {
        const imports = [...out.matchAll(/^import [\s\S]*?from ['"][^'"]+['"];[ \t]*$/gm)];
        const line = `import { ${want.join(', ')} } from '@/constants/theme';`;
        if (imports.length) { const last = imports[imports.length - 1]; const end = last.index + last[0].length; out = out.slice(0, end) + '\n' + line + out.slice(end); }
        else out = line + '\n' + out;
    }

    console.log(`${file}  tables: ${notes.join(', ') || '—'}${used.has('activePalette') ? '  (+helpers)' : ''}${used.has('tone') ? '  (tone)' : ''}${staticPalette ? '  ⚠ static Palette still read' : ''}`);
    if (APPLY) fs.writeFileSync(file, out);
}
console.log(APPLY ? 'APPLIED' : 'dry run');
