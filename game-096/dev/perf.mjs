import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const PKG='/home/user/web-games-andrew/dev/package';
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1280,height:760}})).newPage();
await p.route('https://unpkg.com/**', (r)=>{const f=path.join(PKG,new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//,''));r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(f)});});
await p.route('https://fonts.googleapis.com/**',(r)=>r.fulfill({status:200,contentType:'text/css',body:''}));
p.on('pageerror',e=>console.log('pageerror',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('err',m.text())});
await p.goto('http://127.0.0.1:8096/game-096/index.html?debug=1');
await p.waitForFunction(()=>window.__hh);
for (const id of ['l1_1','l2_1','l3_1','l4_1','l5_2','l5_4']) {
  await p.evaluate((id)=>{__hh.clearAll(); __hh.start(id); __hh.ui.closeAll(); if(__hh.ui.dlg) __hh.ui.dlgSkip(); __hh.ff(6);}, id);
  await p.waitForTimeout(1200);
  const info = await p.evaluate(()=>{const r=__hh.view.stage.renderer.info; return {calls:r.render.calls, tris:r.render.triangles, geos:r.memory.geometries, tex:r.memory.textures}});
  console.log(id, JSON.stringify(info));
}
await b.close();
