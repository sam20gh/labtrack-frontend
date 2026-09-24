#!/usr/bin/env node
// Dark-mode migration, fourth pass: everything drawn inside a heroGradient reads the LIGHT
// palette, because the hero is the same deep violet in both schemes. A white chip on it stays
// white; its dark label stays dark. Styles shared with elements outside a hero are reported,
// not changed. See CLAUDE.md "Dark mode".
// Pin colour inside hero subtrees to the light palette. node hero-pin.js [--apply] files
const ts=require(process.cwd()+'/node_modules/typescript');const fs=require('fs');
const APPLY=process.argv.includes('--apply');const files=process.argv.slice(2).filter(a=>!a.startsWith('--'));
for(const f of files){const src=fs.readFileSync(f,'utf8');const sf=ts.createSourceFile(f,src,99,true,4);
 // makeStyles factory entries
 const sheet={};(function w(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='makeStyles'){let fn=n.arguments[0];let body=fn&&fn.body;while(body&&ts.isParenthesizedExpression(body))body=body.expression;if(body&&ts.isObjectLiteralExpression(body))for(const p of body.properties)if(ts.isPropertyAssignment(p)&&ts.isObjectLiteralExpression(p.initializer))sheet[p.name.getText(sf)]=p.initializer}ts.forEachChild(n,w)})(sf);
 const heroes=[];(function w(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(sf)==='LinearGradient'&&/heroGradient/.test(n.openingElement.getText(sf)))heroes.push(n);ts.forEachChild(n,w)})(sf);
 if(!heroes.length)continue;
 const inHero=(node)=>heroes.some(h=>node.getStart(sf)>=h.getStart(sf)&&node.getEnd()<=h.getEnd());
 // style usage map
 const uses={};(function w(n){if(ts.isPropertyAccessExpression(n)&&n.expression.getText(sf)==='styles'){(uses[n.name.text]=uses[n.name.text]||[]).push(inHero(n))}ts.forEachChild(n,w)})(sf);
 const edits=[];const shared=[];
 for(const [k,obj] of Object.entries(sheet)){const u=uses[k]||[];if(!u.some(Boolean))continue;
   if(u.some(x=>!x)){shared.push(k);continue}
   (function w(n){if(ts.isPropertyAccessExpression(n)&&n.expression.getText(sf)==='Palette'){edits.push([n.expression.getStart(sf),n.expression.getEnd(),'Palettes.light']);return}ts.forEachChild(n,w)})(obj)}
 // inline Palette refs inside hero subtrees (JSX props and inline style objects)
 for(const h of heroes)(function w(n){if(ts.isPropertyAccessExpression(n)&&n.expression.getText(sf)==='Palette'&&!/heroGradient|actionGradient/.test(n.name.text)){edits.push([n.expression.getStart(sf),n.expression.getEnd(),'Palettes.light']);return}ts.forEachChild(n,w)})(h);
 const uniq=[...new Map(edits.map(e=>[e[0],e])).values()].sort((a,b)=>b[0]-a[0]);
 let out=src;for(const [s,e,t] of uniq)out=out.slice(0,s)+t+out.slice(e);
 if(uniq.length&&!/\bPalettes\b[^;]*from '@\/constants\/theme'/.test(out.match(/import \{[^}]*\} from '@\/constants\/theme';/)?.[0]||''))out=out.replace(/import \{([^}]*)\} from '@\/constants\/theme';/,(m,n)=>`import { ${n.trim().replace(/,$/,'')}, Palettes } from '@/constants/theme';`);
 console.log(`${f}  heroes:${heroes.length} pinned:${uniq.length}${shared.length?'  ⚠ shared styles: '+shared.join(','):''}`);
 if(APPLY&&uniq.length)fs.writeFileSync(f,out)}
