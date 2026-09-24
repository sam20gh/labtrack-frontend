#!/usr/bin/env node
/**
 * Dark-mode migration: moves a file from static StyleSheet/Palette onto the live palette.
 * See CLAUDE.md, "Dark mode". Dry run by default; --apply writes. Run from labtrack-frontend/:
 *
 *   node scripts/theme-migrate.js app/nutrition/*.tsx            # report
 *   node scripts/theme-migrate.js --apply app/nutrition/*.tsx    # migrate
 *
 * Then: npx tsc --noEmit, fix what the report flagged, and look at the screen in both schemes.
 */
const ts = require(process.cwd() + '/node_modules/typescript');
const fs = require('fs');

const APPLY = process.argv.includes('--apply');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// Reverse map of exact light values -> token, in preference order for ambiguous values.
const LIGHT = {
    text: '#1F2937', textSecondary: '#6B7280', textMuted: '#9CA3AF', border: '#E5E7EB',
    borderLight: '#F3F4F6', surface: '#FAFAFA', canvas: '#F8FAFC', borderSlate: '#E2E8F0',
    borderStrong: '#CBD5E1', primary: '#7C3AED', primaryDark: '#6D28D9', primaryLight: '#A78BFA',
    primaryPale: '#C4B5FD', primarySurface: '#F3E8FF', primaryDeep: '#2E1065', indigo: '#4F46E5',
    success: '#059669', successDeep: '#047857', successSurface: '#ECFDF5', warning: '#B45309',
    warningSurface: '#FFFBEB', danger: '#DC2626', dangerSurface: '#FEF2F2', info: '#1D4ED8',
    infoSurface: '#EFF6FF', primaryTint: '#F5F3FF', surfaceWarm: '#FDFBF7', indigoSurface: '#EEF2FF',
};
const HEX2TOKEN = {};
for (const [k, v] of Object.entries(LIGHT)) if (!HEX2TOKEN[v]) HEX2TOKEN[v] = k;
const FILL = { primary: 'primaryFill', primaryDark: 'primaryDarkFill', success: 'successFill', warning: 'warningFill', danger: 'dangerFill' };
const BG_PROPS = new Set(['backgroundColor']);
const COLOR_PROPS = /^(color|backgroundColor|borderColor|border(Top|Bottom|Left|Right)Color|shadowColor|tintColor|textDecorationColor|placeholderTextColor|thumbColor|underlineColorAndroid|selectionColor|stroke|fill|stopColor)$/;

const report = [];

for (const file of files) {
  try {
    let src = fs.readFileSync(file, 'utf8');
    // Idempotent: a file already on the live palette is left alone. Running the transform
    // twice would declare `const Palette = usePalette()` twice in every component.
    if (src.includes("from '@/hooks/useTheme'")) { console.log(`${file}  already migrated — skipped`); continue; }
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    const notes = [];
    const edit = (node, text) => edits.push([node.getStart(sf), node.getEnd(), text]);
    const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

    // ---- 1. module-level StyleSheet.create -> makeStyles
    const sheetNames = new Map(); // styles -> useStyles
    const sheetRanges = [];
    for (const st of sf.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
            const init = d.initializer;
            if (init && ts.isCallExpression(init) && init.expression.getText(sf) === 'StyleSheet.create' && ts.isIdentifier(d.name)) {
                const name = d.name.text;
                const hook = 'use' + name[0].toUpperCase() + name.slice(1);
                sheetNames.set(name, hook);
                edit(d.name, hook);
                edit(init.expression, 'makeStyles');
                const arg = init.arguments[0];
                edits.push([arg.getStart(sf), arg.getStart(sf), '(Palette) => (']);
                edits.push([arg.getEnd(), arg.getEnd(), ')']);
                sheetRanges.push([init.getStart(sf), init.getEnd()]);
            }
        }
    }
    const inSheet = (n) => sheetRanges.some(([s, e]) => n.getStart(sf) >= s && n.getEnd() <= e);

    // ---- helpers
    const isCapitalised = (s) => /^[A-Z]/.test(s);
    const componentFns = []; // {fn, name}
    const unwrap = (e) => {
        // memo(x), React.memo(x), forwardRef(x), React.forwardRef(x)
        while (e && ts.isCallExpression(e) && /^(React\.)?(memo|forwardRef)$/.test(e.expression.getText(sf)) && e.arguments[0]) e = e.arguments[0];
        return e;
    };
    (function find(n) {
        if (ts.isFunctionDeclaration(n) && n.name && isCapitalised(n.name.text) && n.body) componentFns.push({ fn: n, name: n.name.text });
        else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && isCapitalised(n.name.text) && n.initializer) {
            const f = unwrap(n.initializer);
            if (f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) componentFns.push({ fn: f, name: n.name.text });
        } else if (ts.isExportAssignment(n)) {
            const f = unwrap(n.expression);
            if (f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) componentFns.push({ fn: f, name: 'default' });
        } else if (ts.isCallExpression(n) && /^(React\.)?(memo|forwardRef)$/.test(n.expression.getText(sf))) {
            const f = n.arguments[0];
            if (f && ts.isFunctionExpression(f) && f.name && isCapitalised(f.name.text)) componentFns.push({ fn: f, name: f.name.text });
        }
        ts.forEachChild(n, find);
    })(sf);
    // Only outermost components get hooks (a component nested in another is still a component,
    // but it has its own body and gets its own hooks — keep both, the inner is independent).
    const fnSet = new Set(componentFns.map((c) => c.fn));
    const enclosingComponent = (n) => { for (let p = n.parent; p; p = p.parent) if (fnSet.has(p)) return p; return null; };

    // ---- 2. usage analysis
    const needs = new Map(); // fn -> {palette:bool, sheets:Set}
    let moduleLevelPalette = 0; const moduleLevelPaletteLines = [];
    let orphanStyles = []; let paramDefaults = [];
    (function walk(n) {
        if (ts.isIdentifier(n) && n.parent && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) && !ts.isImportSpecifier(n.parent) && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
            const name = n.text;
            if (name === 'Palette' || sheetNames.has(name)) {
                if (name === 'Palette' && inSheet(n)) { /* factory param */ }
                else {
                    const comp = enclosingComponent(n);
                    if (comp) {
                        // default parameter values run before the hook
                        let inParam = false; for (let p = n.parent; p && p !== comp; p = p.parent) if (ts.isParameter(p)) inParam = true;
                        if (inParam) paramDefaults.push(line(n));
                        const rec = needs.get(comp) || { palette: false, sheets: new Set() };
                        if (name === 'Palette') rec.palette = true; else rec.sheets.add(name);
                        needs.set(comp, rec);
                    } else if (name === 'Palette') { moduleLevelPalette++; moduleLevelPaletteLines.push(line(n)); }
                    else orphanStyles.push(line(n));
                }
            }
        }
        ts.forEachChild(n, walk);
    })(sf);

    // ---- 4. semantic swaps + hex literals (style sheets, inline style objects, JSX colour props)
    let hexSwaps = 0, fillSwaps = 0, whiteBg = 0;
    (function walk(n) {
        if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) {
            const prop = n.name.text; const init = n.initializer; const t = init.getText(sf);
            const m = t.match(/^Palette\.(\w+)$/);
            if (BG_PROPS.has(prop) && m) {
                if (m[1] === 'white') { edit(init, 'Palette.background'); whiteBg++; }
                else if (FILL[m[1]]) { edit(init, 'Palette.' + FILL[m[1]]); fillSwaps++; }
            } else if (COLOR_PROPS.test(prop) && ts.isStringLiteral(init)) {
                // Outside a sheet the swap needs a hook: inside a component, register it; at
                // module level there is none to be had, so the literal stays.
                if (!inSheet(n)) {
                    const comp = enclosingComponent(n);
                    if (!comp) { ts.forEachChild(n, walk); return; }
                    const hex0 = init.text.toUpperCase().replace(/^#FFF$/, '#FFFFFF');
                    if (hex0 === '#FFFFFF' || HEX2TOKEN[hex0]) { const rec = needs.get(comp) || { palette: false, sheets: new Set() }; rec.palette = true; needs.set(comp, rec); }
                }
                const hex = init.text.toUpperCase().replace(/^#FFF$/, '#FFFFFF');
                if (hex === '#FFFFFF') { edit(init, BG_PROPS.has(prop) ? 'Palette.background' : 'Palette.white'); hexSwaps++; }
                else if (HEX2TOKEN[hex]) {
                    const tok = HEX2TOKEN[hex];
                    edit(init, 'Palette.' + (BG_PROPS.has(prop) && FILL[tok] ? FILL[tok] : tok)); hexSwaps++;
                }
            }
        } else if (ts.isJsxAttribute(n) && COLOR_PROPS.test(n.name.getText(sf)) && n.initializer) {
            let lit = null;
            if (ts.isStringLiteral(n.initializer)) lit = n.initializer;
            else if (ts.isJsxExpression(n.initializer) && n.initializer.expression && ts.isStringLiteral(n.initializer.expression)) lit = n.initializer.expression;
            if (lit) {
                const hex = lit.text.toUpperCase().replace(/^#FFF$/, '#FFFFFF');
                let tok = hex === '#FFFFFF' ? 'white' : HEX2TOKEN[hex];
                if (tok && !enclosingComponent(n)) tok = null;
                if (tok) {
                    edits.push([n.initializer.getStart(sf), n.initializer.getEnd(), `{Palette.${tok}}`]); hexSwaps++;
                    const comp = enclosingComponent(n);
                    if (comp) { const rec = needs.get(comp) || { palette: false, sheets: new Set() }; if (!rec.palette) { rec.palette = true; needs.set(comp, rec);  } }
                }
            }
        }
        ts.forEachChild(n, walk);
    })(sf);

    // ---- 3. insert hook calls
    for (const [fn, rec] of needs) {
        const decls = [];
        if (rec.palette) decls.push('const Palette = usePalette();');
        for (const s of rec.sheets) decls.push(`const ${s} = ${sheetNames.get(s)}();`);
        if (!decls.length) continue;
        const body = fn.body;
        if (ts.isBlock(body)) {
            const pos = body.getStart(sf) + 1;
            // indentation: first statement's column, else fn column + 4
            const first = body.statements[0];
            const indent = first ? ' '.repeat(sf.getLineAndCharacterOfPosition(first.getStart(sf)).character) : '    ';
            edits.push([pos, pos, '\n' + decls.map((d) => indent + d).join('\n')]);
        } else {
            // Indent from the start of the line the function begins on, not from the function's
            // own column: `const X = () => (` starts mid-line.
            const lineStart = src.lastIndexOf('\n', fn.getStart(sf)) + 1;
            const col = (src.slice(lineStart).match(/^\s*/) || [''])[0].length;
            const indent = ' '.repeat(col + 4);
            const exprStart = body.getStart(sf), exprEnd = body.getEnd();
            // Insertions only — a prefix, a suffix, and four spaces at the start of each inner
            // line — so colour swaps inside the same body can still apply alongside.
            edits.push([exprStart, exprStart, '{\n' + decls.map((d) => indent + d).join('\n') + '\n' + indent + 'return ']);
            for (let i = src.indexOf('\n', exprStart); i !== -1 && i < exprEnd; i = src.indexOf('\n', i + 1)) {
                if (src[i + 1] !== '\n') edits.push([i + 1, i + 1, '    ']);
            }
            edits.push([exprEnd, exprEnd, ';\n' + ' '.repeat(col) + '}']);
        }
    }

    const remainingHex = (src.match(/['"]#[0-9A-Fa-f]{3,8}['"]/g) || []).length - hexSwaps;

    // ---- 5. imports
    let out = src;
    const sorted = edits.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    // guard overlaps
    for (let i = 1; i < sorted.length; i++) if (sorted[i][1] > sorted[i - 1][0] && sorted[i][0] !== sorted[i - 1][0]) throw new Error(`${file}: overlapping edits at ${sorted[i][0]}`);
    for (const [s, e, t] of sorted) out = out.slice(0, s) + t + out.slice(e);

    const usesHookPalette = /usePalette\(\)/.test(out), usesMake = /makeStyles\(/.test(out);
    const need = [usesMake && 'makeStyles', usesHookPalette && 'usePalette'].filter(Boolean);
    if (need.length && !/from '@\/hooks\/useTheme'/.test(out)) {
        const line = `import { ${need.join(', ')} } from '@/hooks/useTheme';`;
        if (/import [^;]*from '@\/constants\/theme';/.test(out)) {
            out = out.replace(/(import [^;]*from '@\/constants\/theme';)/, `$1\n${line}`);
        } else {
            // No theme import to sit beside: after the last top-level import instead.
            const imports = [...out.matchAll(/^import [\s\S]*?from ['"][^'"]+['"];[ \t]*$/gm)];
            if (imports.length) { const end = imports[imports.length - 1].index + imports[imports.length - 1][0].length; out = out.slice(0, end) + '\n' + line + out.slice(end); }
            else notes.push('NO IMPORT ANCHOR');
        }
    }
    // drop StyleSheet from the react-native import when unused
    if (!/StyleSheet\./.test(out.replace(/import[\s\S]*?;/g, ''))) {
        out = out.replace(/import \{([^}]*)\} from 'react-native';/, (m, names) => {
            const kept = names.split(',').map((x) => x.trim()).filter((x) => x && x !== 'StyleSheet');
            return `import { ${kept.join(', ')} } from 'react-native';`;
        });
    }
    // drop the static Palette import when nothing at module level still reads it
    if (moduleLevelPalette === 0) {
        out = out.replace(/import \{([^}]*)\} from '@\/constants\/theme';/, (m, names) => {
            const kept = names.split(',').map((x) => x.trim()).filter((x) => x && x !== 'Palette');
            return kept.length ? `import { ${kept.join(', ')} } from '@/constants/theme';` : '';
        });
    }

    report.push({ file, sheets: sheetNames.size, components: needs.size, fillSwaps, whiteBg, hexSwaps, remainingHex, moduleLevelPalette: moduleLevelPaletteLines.slice(0, 6), orphanStyles: orphanStyles.slice(0, 6), paramDefaults, notes });
    if (APPLY) fs.writeFileSync(file, out);
  } catch (err) {
    report.push({ file, sheets: 0, components: 0, fillSwaps: 0, whiteBg: 0, hexSwaps: 0, remainingHex: 0, moduleLevelPalette: [], orphanStyles: [], paramDefaults: [], notes: ['FAILED: ' + err.message] });
  }
}

for (const r of report) {
    const flags = [];
    if (r.moduleLevelPalette.length) flags.push(`static Palette @${r.moduleLevelPalette.join(',')}`);
    if (r.orphanStyles.length) flags.push(`styles outside a component @${r.orphanStyles.join(',')}`);
    if (r.paramDefaults.length) flags.push(`param default @${r.paramDefaults.join(',')}`);
    if (r.remainingHex > 0) flags.push(`${r.remainingHex} hex left`);
    if (r.notes.length) flags.push(r.notes.join('; '));
    console.log(`${r.file}  sheets:${r.sheets} comps:${r.components} fill:${r.fillSwaps} whiteBg:${r.whiteBg} hex:${r.hexSwaps}${flags.length ? '\n    ⚠ ' + flags.join(' | ') : ''}`);
}
console.log(APPLY ? 'APPLIED' : 'dry run');
