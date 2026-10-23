const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage({viewport:{width:1440,height:1050}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:4173/?model=helicopter');await p.waitForFunction(()=>window.fpvDiagnostics?.().ready);
await p.evaluate(()=>window.navigationMarker='same-document');
await expect(p.locator('select#model-version')).toHaveCount(0);await expect(p.locator('.site-logo img')).toHaveJSProperty('naturalWidth',await p.locator('.site-logo img').evaluate(el=>el.naturalWidth));assert.ok(await p.locator('.site-logo img').evaluate(el=>el.naturalWidth>0));
await p.locator('#rotate').click();await p.screenshot({path:'artifacts/helicopter-preview.png'});
for(const [button,version,count] of [['#model-next','custom',14],['#model-next','original',13],['#model-next','fixed-wing',1],['#model-next','helicopter',1],['#model-prev','fixed-wing',1]]){
await p.locator(button).click();await p.waitForFunction(()=>!!fpvDiagnostics().flight);await expect(p.locator(button)).toBeDisabled();
await p.waitForFunction(v=>fpvDiagnostics().modelVersion===v&&!fpvDiagnostics().animating,version);assert.equal(await p.evaluate(()=>window.navigationMarker),'same-document');assert.equal(await p.evaluate(()=>fpvDiagnostics().parts.length),count);
}
await p.locator('#model-next').click();await p.waitForFunction(()=>!fpvDiagnostics().animating);
await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>!fpvDiagnostics().animating);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#viewer').scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/helicopter-mobile.png'});
await p.emulateMedia({reducedMotion:'reduce'});await p.reload();await p.waitForFunction(()=>window.fpvDiagnostics?.().ready);await p.locator('#model-next').click();await p.waitForFunction(()=>fpvDiagnostics().modelVersion==='custom'&&!fpvDiagnostics().animating);
let cachedRequests=0;await p.route('**/fpv-drone3-v3.glb',r=>{cachedRequests++;return r.abort();});await p.locator('#model-next').click();await p.waitForFunction(()=>fpvDiagnostics().modelVersion==='original'&&!fpvDiagnostics().animating);await expect(p.locator('#model-next')).toBeEnabled();assert.equal(cachedRequests,0,'preloaded models switch without fetching');await p.unroute('**/fpv-drone3-v3.glb');
await p.goto('http://127.0.0.1:4173/downloads');const links=await p.locator('.download-card a[target="_blank"]').evaluateAll(a=>a.map(x=>x.href));assert.equal(links.length,4);assert.ok(links.some(x=>x.includes('ardupilot.org')));assert.ok(links.some(x=>x.includes('inav-configurator')));await p.goto('http://127.0.0.1:4173/downloads/tool-5');await expect(p.locator('.panel a[target="_blank"]')).toHaveAttribute('href','https://ardupilot.org/planner/docs/mission-planner-installation.html');assert.deepEqual(errors,[]);console.log('PASS: four-model carousel, both flight animations, no reload, mobile, reduced motion, cached offline switching, logo and official download links.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
