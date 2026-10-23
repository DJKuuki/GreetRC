const {chromium} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1050}});
    const external=[], errors=[], failed=[];
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1') return route.continue();
      external.push(url.href);return route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(()=>window.fpvDiagnostics?.().ready,{},{timeout:90000});
    await page.getByRole('button',{name:'暂停旋转',exact:true}).click();
    assert.equal((await page.evaluate(()=>fpvDiagnostics())).parts.length,14);
    const out=path.join(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'assembled.png')});
    await page.getByRole('button',{name:'↗ 拆解模型',exact:true}).click();
    await page.waitForFunction(()=>fpvDiagnostics().expanded&&!fpvDiagnostics().animating);
    const exploded=await page.evaluate(()=>fpvDiagnostics());
    assert.ok(exploded.parts.some(p=>p.position.some((v,i)=>Math.abs(v-p.origin[i])>1)));
    await page.screenshot({path:path.join(out,'exploded.png')});
    await page.locator('[data-part="fc"]').click();
    await page.getByRole('heading',{name:'飞控',exact:true}).waitFor();
    await page.getByRole('button',{name:'关闭部件说明'}).click();
    // Exercise actual canvas hit testing across the expanded model.
    const canvas=await page.locator('canvas').boundingBox();let picked=false;
    for(let y=canvas.y+80;y<canvas.y+canvas.height-110&&!picked;y+=35){
      for(let x=canvas.x+60;x<canvas.x+canvas.width-40&&!picked;x+=35){
        await page.mouse.click(x,y);
        picked=!!(await page.evaluate(()=>fpvDiagnostics().selected));
      }
    }
    assert.ok(picked,'raycasting should select a part');
    await page.getByRole('button',{name:'关闭部件说明'}).click();
    await page.getByRole('button',{name:'↙ 组装模型',exact:true}).click();
    await page.waitForFunction(()=>!fpvDiagnostics().expanded&&!fpvDiagnostics().animating);
    const restored=await page.evaluate(()=>fpvDiagnostics());
    restored.parts.forEach(p=>assert.deepEqual(p.position,p.origin));
    await page.getByRole('button',{name:'暂停旋转',exact:true}).click();
    const beforeDrag=await page.evaluate(()=>fpvDiagnostics().camera);
    await page.mouse.move(canvas.x+canvas.width*.45,canvas.y+canvas.height*.45);
    await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.6,canvas.y+canvas.height*.5,{steps:12});await page.mouse.up();
    await page.waitForTimeout(300);
    assert.notDeepEqual(await page.evaluate(()=>fpvDiagnostics().camera),beforeDrag);
    const beforeZoom=await page.evaluate(()=>fpvDiagnostics().camera);
    await page.mouse.wheel(0,-200);await page.waitForTimeout(300);
    assert.notDeepEqual(await page.evaluate(()=>fpvDiagnostics().camera),beforeZoom);
    await page.getByRole('button',{name:'重置视角',exact:true}).click();
    await page.waitForFunction(()=>!fpvDiagnostics().animating);
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'↗ 拆解模型',exact:true}).click();
    await page.waitForFunction(()=>fpvDiagnostics().expanded&&!fpvDiagnostics().animating);
    await page.screenshot({path:path.join(out,'mobile-exploded.png'),fullPage:true});
    assert.deepEqual(external,[],'no external requests');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    console.log(JSON.stringify({passed:true,parts:14,externalRequests:external,errors,checks:['local Draco / GLB load','expand','exact assembly restoration','part details','canvas picking','drag','zoom input','reset','mobile layout'],screenshots:out},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
