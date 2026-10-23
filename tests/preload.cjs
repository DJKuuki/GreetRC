const {chromium, expect} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const files = ['fpv-drone3-v3-white-blue.glb', 'fpv-drone3-v3.glb', 'fixed-wing-sport.glb', 'helicopter.glb'];
const origin = 'http://127.0.0.1:4173';

(async () => {
  fs.mkdirSync('artifacts', {recursive:true});
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}, colorScheme:'light'});
    const page = await context.newPage();
    const requests = new Map(), errors = [], failures = [];
    page.on('request', request => {
      const name = new URL(request.url()).pathname.split('/').at(-1);
      if (files.includes(name) || /draco.*\.(wasm|js)$/.test(name)) requests.set(name,(requests.get(name)||0)+1);
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if(response.status()>=400)failures.push(response.url());});
    let release;
    const held = new Promise(resolve => {release=resolve;});
    await page.route('**/helicopter.glb', async route => {await held;await route.continue();});
    await page.goto(origin);
    await expect(page.locator('#experience-loader')).toBeVisible();
    await expect(page.locator('#experience')).toHaveAttribute('inert','');
    await page.waitForFunction(() => {
      const d=window.fpvDiagnostics?.();
      return d && ['custom','original','fixed-wing'].every(v=>d.preload.progress[v]>=.8);
    }, {}, {timeout:90000});
    assert.equal(await page.evaluate(() => fpvDiagnostics().ready),false);
    assert.ok(Number(await page.locator('.boot-progress').getAttribute('aria-valuenow'))<100);
    await page.screenshot({path:'artifacts/loading-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('.boot-wordmark').evaluate(element => element.scrollWidth<=innerWidth));
    await page.screenshot({path:'artifacts/loading-mobile.png'});
    await page.emulateMedia({colorScheme:'dark'});
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await page.screenshot({path:'artifacts/loading-dark.png'});
    await page.emulateMedia({colorScheme:'light'});
    await page.setViewportSize({width:1440,height:1000});
    release();
    await page.waitForFunction(() => window.fpvDiagnostics?.().ready, {}, {timeout:120000});
    await expect(page.locator('#experience-loader')).toBeHidden();
    assert.equal(await page.evaluate(() => fpvDiagnostics().preload.prepared),4);
    for(const file of files)assert.equal(requests.get(file),1,file);
    const before = await page.evaluate(() => fpvDiagnostics().memory);
    const timings = [];
    await context.setOffline(true);
    for(const [button,version,count] of [
      ['#model-next','original',13],['#model-next','fixed-wing',1],['#model-next','helicopter',1],['#model-next','custom',14],
      ['#model-next','original',13],['#model-next','fixed-wing',1],['#model-next','helicopter',1],['#model-next','custom',14],['#model-prev','helicopter',1],
    ]) {
      const timing = await page.evaluate(async button => {
        const start=performance.now();document.querySelector(button).click();
        await new Promise(resolve => {
          function sample(){if(fpvDiagnostics().flight||!fpvDiagnostics().switching)resolve();else requestAnimationFrame(sample);}
          sample();
        });
        return performance.now()-start;
      },button);
      timings.push({version,startDelayMs:Math.round(timing)});
      assert.ok(timing<750,`Cached ${version} should start promptly: ${timing}ms`);
      await page.waitForFunction(version=>fpvDiagnostics().modelVersion===version&&!fpvDiagnostics().animating,version);
      assert.equal(await page.evaluate(()=>fpvDiagnostics().parts.length),count);
    }
    for(const file of files)assert.equal(requests.get(file),1,'Switches must not request '+file);
    const after=await page.evaluate(()=>fpvDiagnostics().memory);
    assert.equal(after.geometries,before.geometries,'Cached switches must not create more geometry');
    assert.equal(after.textures,before.textures,'Cached switches must not create more textures');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    await context.close();

    const recovery = await browser.newPage({reducedMotion:'reduce'});
    const recoveryRequests = new Map();
    let fail=true;
    recovery.on('request',request=>{
      const file=new URL(request.url()).pathname.split('/').at(-1);
      if(files.includes(file))recoveryRequests.set(file,(recoveryRequests.get(file)||0)+1);
    });
    await recovery.route('**/helicopter.glb',route=>fail?route.abort():route.continue());
    await recovery.goto(origin+'/?lang=en');
    await expect(recovery.locator('#boot-retry')).toBeVisible({timeout:90000});
    await expect(recovery.locator('#boot-status')).toContainText('Check your connection');
    await expect(recovery.locator('#experience')).toHaveAttribute('inert','');
    assert.equal(await recovery.evaluate(()=>fpvDiagnostics().ready),false);
    fail=false;
    await recovery.getByRole('button',{name:'Try again',exact:true}).click();
    await recovery.waitForFunction(()=>window.fpvDiagnostics?.().ready,{}, {timeout:120000});
    await expect(recovery.locator('#experience-loader')).toBeHidden();
    for(const file of files)assert.equal(recoveryRequests.get(file),file==='helicopter.glb'?2:1,'Retry should reuse healthy '+file);
    await recovery.close();
    const report={passed:true,requests:Object.fromEntries(requests),timings,memory:{before,after},checks:['all four assets required before entering', 'desktop/mobile/dark loading design', 'GPU preparation', 'offline cached cycling', 'stable geometry and texture counts', 'failed asset retry without reloading healthy assets'],errors,failures};
    fs.writeFileSync('artifacts/preload-report.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
